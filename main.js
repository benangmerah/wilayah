var fs = require('fs');
var util = require('util');
var csv = require('csv');
var _s = require('underscore.string');

var BmDriverBase = require('benangmerah-driver-base');

var RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
var RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
var OWL_NS = 'http://www.w3.org/2002/07/owl#';
var XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
var BM_NS = 'http://benangmerah.net/ontology/';
var PLACE_NS = 'http://benangmerah.net/place/idn/';
var BPS_NS = 'http://benangmerah.net/place/idn/bps/';
var GEO_NS = 'http://www.w3.org/2003/01/geo/wgs84_pos#';
var QB_NS = 'http://purl.org/linked-data/cube#';

// Location of the Permendagri CSV as our main datasource
var permendagriCSV = __dirname + '/datasources/permendagri-18-2013/buku-induk.tabula-processed.csv';

// Use the BPS-provided dataset for latitude/longitude information
// Aside from lat-long, the dataset isn't accurate as there are many human errors
// Source: http://data.ukp.go.id/dataset/daftar-nama-daerah/
var bpsCSV = __dirname + '/datasources/daftar-nama-daerah.csv';

var nameReplace = {
  '\\s+': ' ',
  ' - ': '-',
  '\\s?/\\s?': '/',
  'Kep\\.': 'Kepulauan',
  '^Daista ': 'DI ',
  '^DKI ': 'DKI ',
  '^Kab\\. ': 'Kabupaten ',
  'Adm\\.': 'Administrasi',

  // More specific replacements...
  'Siau Tagulandang B$': 'Siau Tagulandang Biaro',
  'Bolaang Mongondow Ut$': 'Bolaang Mongondow Utara',
  'Bolaang Mongondow Se$': 'Bolaang Mongondow Selatan'
};

function sanitizeName(name, titleize) {
  var output = name;

  output = output.trim();
  output = output.replace(/^[0-9]+/, '');
  output = output.trim();

  if (titleize) 
    output = _s.titleize(output);

  for (var replace in nameReplace) {
    var r = new RegExp(replace, 'ig');
    var w = nameReplace[replace];
    output = output.replace(r, w);
  }

  return output;
}

function placeURI(province, regency, district, subdistrict) {
  var uri = PLACE_NS;

  if (province)
    uri += _s.slugify(province);
  if (province && regency)
    uri += '/' + _s.slugify(regency);
  if (province && regency && district)
    uri += '/' + _s.slugify(district);
  if (province && regency && district && subdistrict)
    uri += '/' + _s.slugify(subdistrict);

  return uri;
}

function lit(value) {
  return '"' + value + '"';
}

function bpsURI(divisionCode) {
  return BPS_NS + divisionCode.replace(/\./g, '');
}

function WilayahDriver() {}

util.inherits(WilayahDriver, BmDriverBase);

module.exports = WilayahDriver;

// Parse BPS dataset for lat-long
WilayahDriver.prototype.parseBPS = function parseBPS(callback) {
  var self = this;
  // Associative array of lat-longs
  // The key is the BPS code of the place
  var latLongs = {};
  csv()
    .from.path(bpsCSV)
    .to.array(function(rows) {
        rows.forEach(function(row) {
          var bpsCode = parseInt(row[3]);
          if (bpsCode > 0 && (bpsCode < 100 || bpsCode > 999)) {
            bpsCode = '' + bpsCode;
            latLongs[bpsCode] = {
              latitude: row[5],
              longitude: row[6]
            };
          }
        });

        self.latLongs = latLongs;

        callback();
      });
};

// Parse Permendagri dataset for everything else
WilayahDriver.prototype.parsePermendagri =
function parsePermendagri(callback) {
  var self = this;
  var latLongs = self.latLongs;

  csv()
    .from.path(permendagriCSV)
    .to.array(function(rows) {
      var currentProvince = '';
      var currentRegency = '';
      var currentDistrict = '';

      rows.forEach(function(row) {
        while (row[0].trim() === '') {
          row.shift();
        }
        row.forEach(function(value, key) {
          row[key] = value.trim();
          var spaced = row[key].match(/([a-zA-Z]\s){2,}([a-zA-Z])/);
          if (spaced) {
            var spacedWord = spaced[0];
            row[key] = row[key].replace(spacedWord, spacedWord.replace(/ /g, ''));
          }
        });

        if (row.length > 1) {
          // This row is a valid district.
          var divisionCode, uri, type;

          if (row.length >= 3) {
            // A province
            divisionCode = row[1].trim();
            var provinceName = sanitizeName(row[2], true);

            currentProvince = provinceName;

            uri = placeURI(provinceName);
            self.addTriple(uri, RDF_NS + 'type', BM_NS + 'Provinsi');
            self.addTriple(uri, RDFS_NS + 'label', lit(provinceName));
            self.addTriple(uri, RDFS_NS + 'label', lit(provinceName) + '@id');
            self.addTriple(uri, BM_NS + 'hasGovernmentCode', lit(divisionCode));

            // Add OWL equivalence for URI referring to BPS code
            self.addTriple(uri, OWL_NS + 'sameAs', bpsURI(divisionCode));
            // self.addTriple(KODWIL_NS + divisionCode, OWL_NS + 'sameAs', uri);

            if (/Yogyakarta$/.test(provinceName)) {
              self.addTriple(uri, RDFS_NS + 'label', '"Daerah Istimewa Yogyakarta"');
              self.addTriple(uri, RDFS_NS + 'label', '"Daista Yogyakarta"');
              self.addTriple(uri, RDFS_NS + 'label', '"DIY"');
              // self.addTriple(placeURI('Yogyakarta'), OWL_NS + 'sameAs', uri);
              // self.addTriple(placeURI('Daista Yogyakarta'), OWL_NS + 'sameAs', uri);
              // self.addTriple(placeURI('DIY'), OWL_NS + 'sameAs', uri);
            }
            else if (/Jakarta$/.test(provinceName)) {
              self.addTriple(uri, RDFS_NS + 'label', '"Jakarta"');
              self.addTriple(uri, RDFS_NS + 'label', '"DKI"');
              // self.addTriple(placeURI('Jakarta'), OWL_NS + 'sameAs', uri);
              // self.addTriple(placeURI('DKI'), OWL_NS + 'sameAs', uri);
            }
          }

          else if (row.length >= 2) {
            divisionCode = row[0];

            if (divisionCode.length == 5) {
              // A kota/kabupaten
              var regencyName = sanitizeName(row[1], true);

              currentRegency = regencyName;

              var provinceURI = placeURI(currentProvince);
              uri = placeURI(currentProvince, regencyName);

              type = 'Kabupaten';
              var shortLabel = 'Kab. ';
              if (regencyName.match(/^Kabupaten Administrasi/)) {
                type = 'KabupatenAdministrasi';
                shortLabel = 'Kab. Adm. ';
              }
              else if (regencyName.match(/^Kota Administrasi/)) {
                type = 'KotaAdministrasi';
                shortLabel = 'Kota Adm. ';
              }
              else if (regencyName.match(/^Kota/)) {
                type = 'Kota';
                shortLabel = 'Kota ';
              }

              var labelMatch = regencyName.match(/^(?:Kabupaten|Kota)(?: Administrasi)? (.+)/);
              var label = labelMatch[1];
              shortLabel += label;

              self.addTriple(uri, RDF_NS + 'type', BM_NS + type);
              self.addTriple(uri, RDFS_NS + 'label', lit(regencyName));
              self.addTriple(uri, RDFS_NS + 'label', lit(label));
              self.addTriple(uri, RDFS_NS + 'label', lit(shortLabel));
              self.addTriple(uri, RDFS_NS + 'label', lit(regencyName) + '@id');
              self.addTriple(uri, RDFS_NS + 'label', lit(label) + '@id');
              self.addTriple(uri, RDFS_NS + 'label', lit(shortLabel) + '@id');
              self.addTriple(uri, BM_NS + 'hasParent', provinceURI);
              self.addTriple(uri, BM_NS + 'hasGovernmentCode', lit(divisionCode));

              // Add OWL equivalence for URI referring to BPS code
              self.addTriple(uri, OWL_NS + 'sameAs', bpsURI(divisionCode));
              // self.addTriple(KODWIL_NS + divisionCode, OWL_NS + 'sameAs', uri);
            }
            else {
              // A kecamatan
              var districtName = sanitizeName(row[1]);

              // Process according to the available district name
              var regencyURI = placeURI(currentProvince, currentRegency);
              uri = placeURI(currentProvince, currentRegency, districtName);

              // 'Kecamatan' in Papua and Papua Barat is called 'Distrik'
              type = /^Papua/.test(currentProvince) ? 'Distrik' : 'Kecamatan';

              self.addTriple(uri, RDF_NS + 'type', BM_NS + type);
              self.addTriple(uri, RDFS_NS + 'label', lit(districtName));
              self.addTriple(uri, RDFS_NS + 'label', lit(type + ' ' + districtName));
              self.addTriple(uri, RDFS_NS + 'label', lit(districtName) + '@id');
              self.addTriple(uri, RDFS_NS + 'label', lit(type + ' ' + districtName) + '@id');
              self.addTriple(uri, BM_NS + 'hasParent', regencyURI);
              self.addTriple(uri, BM_NS + 'hasGovernmentCode', lit(divisionCode));

              // Add OWL equivalence for URI referring to BPS code
              self.addTriple(uri, OWL_NS + 'sameAs', bpsURI(divisionCode));
              // self.addTriple(KODWIL_NS + divisionCode, OWL_NS + 'sameAs', uri);

              var parenthesesMatch = districtName.match(/(.+)\s\((.+)\)/),
                  slashMatch = districtName.match(/(.+)\s?\/\s?(.+)/);

              if (parenthesesMatch || slashMatch) {
                if (parenthesesMatch) {
                  alt1 = parenthesesMatch[1];
                  alt2 = parenthesesMatch[2];
                }
                else if (slashMatch) {
                  alt1 = slashMatch[1];
                  alt2 = slashMatch[2];
                }

                altUri1 = placeURI(currentProvince, currentRegency, alt1);
                altUri2 = placeURI(currentProvince, currentRegency, alt2);
                self.addTriple(altUri1, OWL_NS + 'sameAs', uri);
                self.addTriple(altUri2, OWL_NS + 'sameAs', uri);
              }
            }
          }

          var bpsCode = divisionCode.replace(/\./g, '');
          var pos = latLongs[bpsCode];
          if (pos) {
            self.addTriple(uri, GEO_NS + 'lat', lit(pos.latitude));
            self.addTriple(uri, GEO_NS + 'long', lit(pos.longitude));
          }
        }
      });

      callback(null, self);
    });
};

WilayahDriver.prototype.fetch = function() {
  var self = this;

  self.parseBPS(function() {
    self.parsePermendagri(function() {
      self.finish();
    });
  });
};

BmDriverBase.handleCLI();