var fs = require('fs'),
    csv = require('csv'),
    _s = require('underscore.string'),
    n3 = require('n3'),
    util = require('util');

// Namespaces
var rdfNS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
var rdfsNS = 'http://www.w3.org/2000/01/rdf-schema#';
var owlNS = 'http://www.w3.org/2002/07/owl#';
var ontNS = 'http://benangmerah.net/ontology/';
var placeNS = 'http://benangmerah.net/place/idn/';
var kodwilNS = 'urn:kode-wilayah-indonesia:';
var bpsNS = 'http://benangmerah.net/place/idn/bps/';

var prefixes = {
  'rdf': rdfNS,
  'rdfs': rdfsNS,
  'owl': owlNS,
  'wil': kodwilNS,
  'bps': bpsNS,
  '': ontNS
}

var inputCSV = './datasources/permendagri-18-2013/buku-induk.tabula-processed.csv';

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

function parse(callback, triples) {
  csv()
    .from.path(inputCSV)
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
        }
      });

      callback(null, triples);
    })
}

exports.getTripleStore = function getTripleStore(callback) {
  var tripleStore = n3.Store(null, prefixes);

  parse(function flushTriples(err, resultingTriples) {
    if (err) {
      callback(err);
    }
    else {
      callback(null, resultingTriples);
    }
  }, tripleStore);
}

exports.writeTriples = function writeTriples(outputTurtle, callback) {
  var tripleWriter = n3.Writer(prefixes);

  parse(function flushTriples(err, resultingTriples) {
    resultingTriples.end(function(err, result) {
      if (!err) {
        fs.writeFile(outputTurtle, result, callback);
      }
      else {
        callback(err);
      }
    });
  }, tripleWriter);
}

/*
getTripleStore(function(err, tripleStore) {
  var triples = tripleStore.find(null, null, null);
  for (var i = 0; i < 20; ++i) {
    console.log(triples[i]);
  }
});
*/

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