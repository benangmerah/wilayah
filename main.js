var fs = require('fs');
var util = require('util');

var _ = require('lodash');
var _s = require('underscore.string');
var async = require('async');
var byline = require('byline');
var csvrow = require('csvrow');
var csvParser = require('csv-parser');
var geolib = require('geolib');

var BmDriverBase = require('benangmerah-driver-base');

var RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
var RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
var OWL_NS = 'http://www.w3.org/2002/07/owl#';
var XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
var GEO_NS = 'http://www.w3.org/2003/01/geo/wgs84_pos#';
var SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';
var GEONAMES_NS = 'http://sws.geonames.org/';
var BM_NS = 'http://benangmerah.net/ontology/';
var PLACE_NS = 'http://benangmerah.net/place/idn/';
var BPS_NS = 'http://benangmerah.net/place/idn/bps/';

// Location of the Permendagri CSV as our main datasource
var permendagriCSV = __dirname + '/datasources/permendagri-18-2013/buku-induk.tabula-processed.csv';
var bpsCSV = __dirname + '/datasources/daftar-nama-daerah.csv';
var geonamesDump = __dirname + '/datasources/geonames-ID.txt';

var nameReplace = {
  '\\s+': ' ',
  ' - ': '-',
  '\\s?/\\s?': '/',
  'Kep\\.': 'Kepulauan',
  '^Daista ': 'DI ',
  '^DKI ': 'DKI ',
  '^Kab\\.? ': 'Kabupaten ',
  'Adm\\.': 'Administrasi',

  // More specific replacements...
  'Siau Tagulandang B$': 'Siau Tagulandang Biaro',
  'Bolaang Mongondow Ut$': 'Bolaang Mongondow Utara',
  'Bolaang Mongondow Se$': 'Bolaang Mongondow Selatan',
  'Bolaang Mongondow Ti$': 'Bolaang Mongondow Timur'
};

var spacedRegex = /([a-zA-Z]\s){2,}([a-zA-Z])/;
var uselessNumberRegex = /^[0-9]+/;
var yogyaRegex = /Yogyakarta$/;
var jakartaRegex = /Jakarta$/;
var papuaRegex = /^Papua/;
var kabAdmRegex = /^Kabupaten Administrasi/;
var kotaAdmRegex = /^Kota Administrasi/;
var kotaRegex = /^Kota/;
var kabKotaLabelRegex = /^(?:Kabupaten|Kota)(?: Administrasi)? (.+)/;
var parenthesesRegex = /(.+)\s\((.+)\)/;
var slashRegex = /(.+)\s?\/\s?(.+)/;

function sanitizeValue(value) {
  return value.trim();
}
function sanitizeName(name, titleize) {
  var output = name;

  output = output.trim();
  output = output.replace(uselessNumberRegex, '');
  output = output.trim();

  var spaced = spacedRegex.exec(output);
  if (spaced) {
    var spacedWord = spaced[0];
    output = output.replace(spacedWord, spacedWord.replace(/ /g, ''));
  }

  if (titleize) {
    output = _s.titleize(output);
  }

  for (var replace in nameReplace) {
    var r = new RegExp(replace, 'ig');
    var w = nameReplace[replace];
    output = output.replace(r, w);
  }

  return output;
}

function placePath(province, regency, distrinct, subdistrict) {
  var path = '';
  if (province)
    path += _s.slugify(province);
  if (province && regency)
    path += '/' + _s.slugify(regency);
  if (province && regency && district)
    path += '/' + _s.slugify(district);
  if (province && regency && district && subdistrict)
    path += '/' + _s.slugify(subdistrict);

  return path;
}
function placeURI(province, regency, district, subdistrict) {
  return PLACE_NS + placePath(province, regency, distrinct, subdistrict);
}
function lit(value) {
  return '"' + value + '"';
}
function bpsURI(divisionCode) {
  return BPS_NS + divisionCode.toString().replace(/\./g, '');
}

function WilayahDriver() {
  this.pathIndex = {};
  this.nameIndex = {};
  this.bpsIndex = {};
  this.orderIndex = [];
  WilayahDriver.super_();
}

util.inherits(WilayahDriver, BmDriverBase);

module.exports = WilayahDriver;

WilayahDriver.prototype.parsePermendagri = function(callback) {
  var self = this;

  byline(fs.createReadStream(permendagriCSV))
    .on('data', function(line) {
      var place = self.parsePermendagriLine(line);
      if (place) {
        self.addPlace(place);
      }
    })
    .on('end', callback)
    .on('error', callback);
};

function Place() {
  this.path = '';
  this.name = '';
  this.nominalName = '';
  this.fullName = '';
  this.altNames = [];
  this.twinNames = [];
  this.equivalentGeonames = [];
  this.probableGeonames = [];
  this.level = 0;
  this.type = '';
  this.dagriCode = '';
}
Object.defineProperties(Place.prototype, {
  path: {
    get: function() {
      var path = '';
      if (this.parent) {
        path += this.parent.path + '/';
      }
      path += _s.slugify(this.name);
      return path;
    }
  },
  uri: {
    get: function() {
      return PLACE_NS + this.path;
    }
  },
  bpsCode: {
    get: function() {
      return this._bpsCode || this.dagriCode.replace(/\./g, '');
    },
    set: function(value) {
      this._bpsCode = value;
    }
  },
  _bpsCode: {
    enumerable: false
  }
});

WilayahDriver.prototype.parsePermendagriLine = function(line) {
  var self = this;
  var row = csvrow.parse(line.toString());
  while (row[0].trim() === '') {
    row.shift();
  }
  if (row.length <= 1) {
    return;
  }

  row = _.map(row, sanitizeValue);

  var place = new Place();

  if (row.length >= 3) { // A province
    self.currentProvince = place;

    place.name = sanitizeName(row[2], true);
    place.nominalName = place.name;
    place.dagriCode = row[1].trim();
    place.type = 'Provinsi';
    place.level = 1;
    place.fullName = place.type + ' ' + place.name;

    place.altNames.push(place.fullName);
    if (yogyaRegex.test(place.name)) {
      place.altNames
        .push('Daerah Istimewa Yogyakarta', 'Daista Yogyakarta', 'DIY');
    }
    else if (jakartaRegex.test(place.name)) {
      place.altNames.push('Jakarta', 'DKI');
    }
  }
  else {
    place.name = sanitizeName(row[1], true);
    place.dagriCode = row[0].trim();

    if (place.dagriCode.length === 5) { // Kabupaten/Kota
      self.currentRegency = place;

      place.fullName = place.name;

      place.parent = self.currentProvince;
      place.level = 2;

      var shortLabel;
      if (kabAdmRegex.test(place.name)) {
        place.type = 'Kabupaten Administrasi';
        shortLabel = 'Kab. Adm. ';
      }
      else if (kotaAdmRegex.test(place.name)) {
        place.type = 'Kota Administrasi';
        shortLabel = 'Kota Adm. ';
      }
      else if (kotaRegex.test(place.name)) {
        place.type = 'Kota';
        shortLabel = 'Kota ';
      }
      else {
        place.type = 'Kabupaten';
        shortLabel = 'Kab. ';
      }

      var labelMatch = kabKotaLabelRegex.exec(place.name);
      place.nominalName = labelMatch[1];

      place.altNames.push(place.nominalName, shortLabel + place.nominalName);
    }
    else { // Kecamatan
      place.nominalName = place.name;
      place.parent = self.currentRegency;
      place.level = 3;

      if (papuaRegex.test(place.parent.parent.name)) {
        place.type = 'Distrik';
      }
      else {
        place.type = 'Kecamatan';
      }
      place.fullName = place.type + ' ' + place.name;

      place.altNames.push(place.fullName);
      var altMatch =
        parenthesesRegex.exec(place.name) ||
        slashRegex.exec(place.name);

      if (altMatch) {
        place.twinNames.push(altMatch[1], altMatch[2]);
        place.altNames.push(altMatch[1], altMatch[2]);
      }
    }
  }

  return place;
};

WilayahDriver.prototype.addPlace = function(place) {
  var self = this;

  self.pathIndex[place.path] = place;
  self.orderIndex.push(place);

  var names = place.altNames.concat(place.name, place.twinNames);
  _.each(names, function(name) {
    name = name.toLowerCase();
    var inIndex = self.nameIndex[name];
    if (!inIndex) {
      self.nameIndex[name] = [place];
    }
    else if (!_.contains(inIndex, place)) {
      inIndex.push(place);
    }
  });

  var bpsCode = place.bpsCode;
  self.bpsIndex[bpsCode] = place;
};

WilayahDriver.prototype.parseBps = function(callback) {
  var self = this;
  var nameByNid = {};
  self.bpsLatLong = {};

  fs.createReadStream(bpsCSV).pipe(csvParser())
    .on('data', function(row) {
      var bpsCode = row.serial.trim();
      if (!(bpsCode > 0 && (bpsCode < 100 || bpsCode > 999))) {
        return;
      }
      var name = row.name.trim();
      nameByNid[row.nid] = name;
      var parentName = nameByNid[row.parent_nid];

      // Same name, different bpsCode. Replace the bpsCode.
      var nameMatches = self.nameIndex[name.toLowerCase()];
      _.each(nameMatches, function(place) {
        if (parentName && 'Provinsi ' + place.parent.name === parentName) {
          return;
        }

        if (place.bpsCode !== bpsCode) {
          delete self.bpsIndex[place.bpsCode];
          place.bpsCode = bpsCode;
          self.bpsIndex[bpsCode] = place;
        }
      });

      var codeMatch = self.bpsIndex[bpsCode];
      // Same BPS code, different name. Add alternative name.
      // if (codeMatch && codeMatch.name !== name &&
      //     !_.contains(codeMatch.altNames, name) &&
      //     !_.contains(codeMatch.twinNames, name)) {
      //   codeMatch.twinNames.push(name);
      //   process.stdout.write(name + ' ' + bpsCode + '\n');
      //   if (!nameMatches) {
      //     self.nameIndex[name.toLowerCase()] = [codeMatch];
      //   }
      //   else {
      //     nameMatches.push(codeMatch);
      //   }
      // }

      self.bpsLatLong[bpsCode] = {
        latitude: row.latitude,
        longitude: row.longitude
      };
    })
    .on('end', callback)
    .on('error',callback);
};

WilayahDriver.prototype.addBpsLatLong = function(callback) {
  var self = this;
  _.each(self.bpsLatLong, function(pos, bpsCode) {
    if (!self.bpsIndex[bpsCode]) {
      return;
    }

    self.bpsIndex[bpsCode].latitude = pos.latitude;
    self.bpsIndex[bpsCode].longitude = pos.longitude;
  });
  callback();
};

WilayahDriver.prototype.parseGeonames = function(callback) {
  var self = this;
  var analysis = fs.createWriteStream('analysis.txt');

  byline(fs.createReadStream(geonamesDump))
    .on('data', function(line) {
      var values = line.toString().split('\t');
      var geonameId = values[0];
      var asciiname = values[2];
      var altNames = values[3].split(/\s*,\s*/);
      var latitude = values[4];
      var longitude = values[5];
      var featureClass = values[6];
      var gnPos = {
        latitude: latitude,
        longitude: longitude
      };

      var names = altNames.concat(asciiname);
      var mapped = [];
      _.each(names, function(name) {
        name = name.toLowerCase();
        var places = self.nameIndex[name];
        var found = false;
        _.each(places, function(place) {
          // analysis.write(geonameId + ' ' + asciiname + ' = ' + place.name + '\n');
          if (!place.latitude || _.contains(mapped, place) || _.contains(place.probableGeonames, geonameId)) {
            return;
          }
          mapped.push(place);
          place.probableGeonames.push(geonameId);
        });
      });
      _.each(mapped, function(place) {
        var distance = geolib.getDistance(gnPos, place, 1000) / 1000;
        var threshold;
        if (place.level === 1) {
          threshold = 1000;
        }
        if (place.level === 2) {
          threshold = 250;
        }
        if (place.level === 3) {
          threshold = 25;
        }
        if (distance > threshold) {
          return;
        }

        place.equivalentGeonames.push(geonameId);

        analysis.write(geonameId + ' ' + asciiname + ' (' + featureClass + ') ~ ' + place.path + '\n');
        analysis.write('aka: ' + names.join(',') + '\n');
        analysis.write('Distance ' + distance + ' km.\n');
        analysis.write('lat: GN=' + latitude + '\tID=' + place.latitude + '\n');
        analysis.write('lon: GN=' + longitude + '\tID=' + place.longitude + '\n\n');
      });
    })
    .on('end', callback)
    .on('error', callback);
};

WilayahDriver.prototype.addTriples = function(callback) {
  var self = this;

  _.each(self.orderIndex, function(place) {
    self.addTriple(place.uri, RDF_NS + 'type', BM_NS + place.type);

    self.addTriple(place.uri, SKOS_NS + 'preferredLabel', lit(place.fullName));

    var names = _.uniq([place.name, place.nominalName].concat(place.altNames, place.twinNames));
    _.each(names, function(name) {
      self.addTriple(place.uri, RDFS_NS + 'label', lit(name));
    });

    if (place.parent) {
      self.addTriple(place.uri, BM_NS + 'hasParent', place.parent.uri);
    }

    self.addTriple(place.uri, BM_NS + 'hasGovernmentCode', lit(place.dagriCode));
    self.addTriple(place.uri, BM_NS + 'hasBpsCode', lit(place.bpsCode));


    if (place.latitude) {
      self.addTriple(place.uri, GEO_NS + 'lat', lit(place.latitude));
      self.addTriple(place.uri, GEO_NS + 'long', lit(place.longitude));
    }

    self.addTriple(place.uri, OWL_NS + 'sameAs', BPS_NS + place.bpsCode);
    _.each(_.uniq(place.twinNames), function(name) {
      self.addTriple(place.uri, OWL_NS + 'sameAs', place.parent.uri + '/' + _s.slugify(name));
    });
    _.each(place.equivalentGeonames, function(gnId) {
      self.addTriple(place.uri, RDFS_NS + 'seeAlso', GEONAMES_NS + gnId + '/');
    });
  });

  callback();
};

// TODO
// 1. Proper geocoding (use cache to not run out of requests)

WilayahDriver.prototype.fetch = function() {
  var self = this;

  async.series([
    self.parsePermendagri.bind(self),
    self.parseBps.bind(self),
    self.addBpsLatLong.bind(self),
    // self.geocode.bind(self),
    self.parseGeonames.bind(self),
    self.addTriples.bind(self)
  ], function(err) {
    if (err) {
      return self.error(err);
    }

    self.finish();
  });
};

BmDriverBase.handleCLI();