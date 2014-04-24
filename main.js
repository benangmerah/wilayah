var fs = require('fs');
var csv = require('csv');
var _s = require('underscore.string');
var n3 = require('n3');
var util = require('util');

// Namespaces
var rdfNS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
var rdfsNS = 'http://www.w3.org/2000/01/rdf-schema#';
var owlNS = 'http://www.w3.org/2002/07/owl#';
var ontNS = 'http://benangmerah.net/ontology/';
var placeNS = 'http://benangmerah.net/place/idn/';
var kodwilNS = 'urn:kode-wilayah-indonesia:';
var bpsNS = 'http://benangmerah.net/place/idn/bps/';
var geoNS = 'http://www.w3.org/2003/01/geo/wgs84_pos#';

var prefixes = {
  'rdf': rdfNS,
  'rdfs': rdfsNS,
  'owl': owlNS,
  'wil': kodwilNS,
  'bps': bpsNS,
  'geo': geoNS,
  '': ontNS
}

// Location of the Permendagri CSV as our main datasource
var permendagriCSV = './datasources/permendagri-18-2013/buku-induk.tabula-processed.csv';

// Use the BPS-provided dataset for latitude/longitude information
// Aside from lat-long, the dataset isn't accurate as there are many human errors
// Source: http://data.ukp.go.id/dataset/daftar-nama-daerah/
var bpsCSV = './datasources/daftar-nama-daerah.csv';

var nameReplace = {
  '\\s+': ' ',
  ' - ': '-',
  '\\s?/\\s?': '/',
  'Kep\\.': 'Kepulauan',
  '^Daista': 'DI',
  '^DKI': 'DKI',
  '^Kab\\.?': 'Kabupaten',
  'Adm.': 'Administrasi',

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
  var uri = placeNS;

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
  return bpsNS + divisionCode.replace(/\./g, '');
}

// Parse BPS dataset for lat-long
function parseBPS(callback) {

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

        callback(latLongs);
      });
}

// Parse Permendagri dataset for everything else
function parsePermendagri(triples, latLongs, callback) {
  csv()
    .from.path(permendagriCSV)
    .to.array(function(rows) {
      var currentProvince = '';
      var currentRegency = '';
      var currentDistrict = '';

      rows.forEach(function(row) {
        while (row[0].trim() == '') {
          row.shift();
        }
        row.forEach(function(value, key) {
          row[key] = value.trim();
          if (spaced = row[key].match(/([a-zA-Z]\s){2,}([a-zA-Z])/)) {
            var spacedWord = spaced[0];
            row[key] = row[key].replace(spacedWord, spacedWord.replace(/ /g, ''));
          }
        });

        if (row.length > 1) {
          // This row is a valid district.

          if (row.length >= 3) {
            // A province
            var divisionCode = row[1].trim();
            var provinceName = sanitizeName(row[2], true);

            currentProvince = provinceName;

            var uri = placeURI(provinceName);
            triples.addTriple(uri, rdfNS + 'type', ontNS + 'Provinsi');
            triples.addTriple(uri, rdfsNS + 'label', lit(provinceName));
            triples.addTriple(uri, rdfsNS + 'label', lit(provinceName) + '@id');
            triples.addTriple(uri, ontNS + 'hasGovernmentCode', lit(divisionCode));

            // Add OWL equivalence for URI referring to BPS code
            triples.addTriple(uri, owlNS + 'sameAs', bpsURI(divisionCode));
            // triples.addTriple(kodwilNS + divisionCode, owlNS + 'sameAs', uri);

            if (/Yogyakarta$/.test(provinceName)) {
              triples.addTriple(uri, rdfsNS + 'label', '"Daerah Istimewa Yogyakarta"');
              triples.addTriple(uri, rdfsNS + 'label', '"Daista Yogyakarta"');
              triples.addTriple(uri, rdfsNS + 'label', '"DIY"');
              // triples.addTriple(placeURI('Yogyakarta'), owlNS + 'sameAs', uri);
              // triples.addTriple(placeURI('Daista Yogyakarta'), owlNS + 'sameAs', uri);
              // triples.addTriple(placeURI('DIY'), owlNS + 'sameAs', uri);
            }
            else if (/Jakarta$/.test(provinceName)) {
              triples.addTriple(uri, rdfsNS + 'label', '"Jakarta"');
              triples.addTriple(uri, rdfsNS + 'label', '"DKI"');
              // triples.addTriple(placeURI('Jakarta'), owlNS + 'sameAs', uri);
              // triples.addTriple(placeURI('DKI'), owlNS + 'sameAs', uri);
            }
          }

          else if (row.length >= 2) {
            var divisionCode = row[0];

            if (divisionCode.length == 5) {
              // A kota/kabupaten
              var regencyName = sanitizeName(row[1], true);

              currentRegency = regencyName;

              var provinceURI = placeURI(currentProvince);
              var uri = placeURI(currentProvince, regencyName);

              var type = 'Kabupaten';
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

              triples.addTriple(uri, rdfNS + 'type', ontNS + type);
              triples.addTriple(uri, rdfsNS + 'label', lit(regencyName));
              triples.addTriple(uri, rdfsNS + 'label', lit(label));
              triples.addTriple(uri, rdfsNS + 'label', lit(shortLabel));
              triples.addTriple(uri, rdfsNS + 'label', lit(regencyName) + '@id');
              triples.addTriple(uri, rdfsNS + 'label', lit(label) + '@id');
              triples.addTriple(uri, rdfsNS + 'label', lit(shortLabel) + '@id');
              triples.addTriple(uri, ontNS + 'hasParent', provinceURI);
              triples.addTriple(uri, ontNS + 'hasGovernmentCode', lit(divisionCode));

              // Add OWL equivalence for URI referring to BPS code
              triples.addTriple(uri, owlNS + 'sameAs', bpsURI(divisionCode));
              // triples.addTriple(kodwilNS + divisionCode, owlNS + 'sameAs', uri);
            }
            else {
              // A kecamatan
              var districtName = sanitizeName(row[1]);

              // Process according to the available district name
              var regencyURI = placeURI(currentProvince, currentRegency);
              var uri = placeURI(currentProvince, currentRegency, districtName);

              // 'Kecamatan' in Papua and Papua Barat is called 'Distrik'
              var type = /^Papua/.test(currentProvince) ? 'Distrik' : 'Kecamatan';

              triples.addTriple(uri, rdfNS + 'type', ontNS + type);
              triples.addTriple(uri, rdfsNS + 'label', lit(districtName));
              triples.addTriple(uri, rdfsNS + 'label', lit(type + ' ' + districtName));
              triples.addTriple(uri, rdfsNS + 'label', lit(districtName) + '@id');
              triples.addTriple(uri, rdfsNS + 'label', lit(type + ' ' + districtName) + '@id');
              triples.addTriple(uri, ontNS + 'hasParent', regencyURI);
              triples.addTriple(uri, ontNS + 'hasGovernmentCode', lit(divisionCode));

              // Add OWL equivalence for URI referring to BPS code
              triples.addTriple(uri, owlNS + 'sameAs', bpsURI(divisionCode));
              // triples.addTriple(kodwilNS + divisionCode, owlNS + 'sameAs', uri);

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
                triples.addTriple(altUri1, owlNS + 'sameAs', uri);
                triples.addTriple(altUri2, owlNS + 'sameAs', uri);
              }
            }
          }

          var bpsCode = divisionCode.replace(/\./g, '');
          var pos = latLongs[bpsCode];
          if (pos) {
            triples.addTriple(uri, geoNS + 'lat', lit(pos.latitude));
            triples.addTriple(uri, geoNS + 'long', lit(pos.longitude));
          }
        }
      });

      callback(null, triples);
    })
}

function parse(triples, callback) {
  parseBPS(function(latLongs) {
    parsePermendagri(triples, latLongs, callback);
  });
}

exports.getTripleStore = function getTripleStore(callback) {
  var tripleStore = n3.Store(null, prefixes);

  parse(tripleStore, function flushTriples(err, resultingTriples) {
    if (err) {
      callback(err);
    }
    else {
      callback(null, resultingTriples);
    }
  });
}

exports.writeTriples = function writeTriples(outputTurtle, callback) {
  var tripleWriter = n3.Writer(prefixes);

  parse(tripleWriter, function flushTriples(err, resultingTriples) {
    resultingTriples.end(function(err, result) {
      if (!err) {
        fs.writeFile(outputTurtle, result, callback);
      }
      else {
        callback(err);
      }
    });
  });
}

if (require.main === module) {
  var logger = require('winston');
  var minimist = require('minimist');

  var outputTurtle = './instances.ttl';
  var argv = minimist(process.argv.slice(2));
  if (argv.o) {
    outputTurtle = argv.o;
  }

  logger.info('Turtle output will be written to ' + outputTurtle + '.');
  logger.info('Loading CSV...');
  exports.writeTriples(outputTurtle, function(err) {
    if (err) {
      logger.error(err);
    }
    else {
      logger.info('Turtle output successfully written to ' + outputTurtle + '.');
    }
  })
}