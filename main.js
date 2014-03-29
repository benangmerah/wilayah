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
var placeNS = 'http://benangmerah.net/place/';
var kodwilNS = 'urn:kode-wilayah-indonesia:';

var inputCSV = './datasources/permendagri-18-2013/buku-induk.tabula-processed.csv';
var outputTurtle = './instances.ttl';

var nameReplace = {
  '\\s+': ' ',
  ' - ': '-',
  '\\s?/\\s?': '/',
  'Kep\\.': 'Kepulauan',
  '^Daista': 'Daerah Istimewa',
  '^DKI': 'DKI',
  '^Kab\\.?': 'Kabupaten',
  'Adm.': 'Administrasi',

  // More specific replacements...
  'Siau Tagulandang B$': 'Siau Tagulandang Biaro',
  'Bolaang Mongondow Ut$': 'Bolaang Mongondow Utara',
  'Bolaang Mongondow Se$': 'Bolaang Mongondow Selatan'
};

// Kalimantan Utara isn't properly indexed in the Permendagri,
// so list the subdivisions here for special treatment
var subdivisionsOfKalimantanUtara = [
  'Kota Tarakan',
  'Kabupaten Bulungan',
  'Kabupaten Malinau',
  'Kabupaten Nunukan',
  'Kabupaten Tana Tidung'
];

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

csv()
  .from.path(inputCSV)
  .to.array(function(rows) {
    var currentProvince = '';
    var currentFactualProvince = ''; // Including Kalimantan Utara
    var currentRegency = '';
    var currentDistrict = '';

    var addedKalimantanUtara = false;

    var triples = n3.Writer({
      'rdf': rdfNS,
      'rdfs': rdfsNS,
      'owl': owlNS,
      'wil': kodwilNS,
      '': ontNS
    });

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
          currentFactualProvince = currentProvince;

          var uri = placeURI(provinceName);
          triples.addTriple(uri, rdfNS + 'type', ontNS + 'Provinsi');
          triples.addTriple(uri, rdfsNS + 'label', lit(provinceName));
          triples.addTriple(uri, rdfsNS + 'label', lit(provinceName) + '@id');
          triples.addTriple(uri, ontNS + 'hasGovernmentCode', lit(divisionCode));
          // triples.addTriple(kodwilNS + divisionCode, owlNS + 'sameAs', uri);

          if (/Yogyakarta$/.test(provinceName)) {
            triples.addTriple(uri, rdfsNS + 'label', '"DI Yogyakarta"');
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

            if (currentProvince == 'Kalimantan Timur' &&
                subdivisionsOfKalimantanUtara.indexOf(regencyName) != -1) {
              // Since Kalimantan Utara is not registered in the Permendagri,
              // Handle Kalimantan Utara separately.

              currentFactualProvince = 'Kalimantan Utara';

              if (!addedKalimantanUtara) {
                var kalimantanUtaraUri = placeURI('Kalimantan Utara');
                triples.addTriple(kalimantanUtaraUri, rdfNS + 'type', ontNS + 'Provinsi');
                triples.addTriple(kalimantanUtaraUri, rdfsNS + 'label', '"Kalimantan Utara"');
                triples.addTriple(kalimantanUtaraUri, rdfsNS + 'label', '"Kalimantan Utara"@id');
                addedKalimantanUtara = true;
              }
            }
            else if (currentProvince != currentFactualProvince) {
              currentFactualProvince = currentProvince;
            }

            var provinceURI = placeURI(currentFactualProvince);
            var uri = placeURI(currentFactualProvince, regencyName);

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
            // triples.addTriple(kodwilNS + divisionCode, owlNS + 'sameAs', uri);
          }
          else {
            // A kecamatan
            var districtName = sanitizeName(row[1]);

            if (currentProvince == 'Kalimantan Timur' &&
                subdivisionsOfKalimantanUtara.indexOf(currentRegency) != -1) {
              // Since Kalimantan Utara is not registered in the Permendagri,
              // Handle Kalimantan Utara separately.

              currentFactualProvince = 'Kalimantan Utara';
            }
            else if (currentProvince != currentFactualProvince) {
              currentFactualProvince = currentProvince;
            }

            // Process according to the available district name
            var regencyURI = placeURI(currentFactualProvince, currentRegency);
            var uri = placeURI(currentFactualProvince, currentRegency, districtName);

            // 'Kecamatan' in Papua and Papua Barat is called 'Distrik'
            var type = /^Papua/.test(currentFactualProvince) ? 'Distrik' : 'Kecamatan';

            triples.addTriple(uri, rdfNS + 'type', ontNS + type);
            triples.addTriple(uri, rdfsNS + 'label', lit(districtName));
            triples.addTriple(uri, rdfsNS + 'label', lit(type + ' ' + districtName));
            triples.addTriple(uri, rdfsNS + 'label', lit(districtName) + '@id');
            triples.addTriple(uri, rdfsNS + 'label', lit(type + ' ' + districtName) + '@id');
            triples.addTriple(uri, ontNS + 'hasParent', regencyURI);
            triples.addTriple(uri, ontNS + 'hasGovernmentCode', lit(divisionCode));
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

              altUri1 = placeURI(currentFactualProvince, currentRegency, alt1);
              altUri2 = placeURI(currentFactualProvince, currentRegency, alt2);
              triples.addTriple(altUri1, owlNS + 'sameAs', uri);
              triples.addTriple(altUri2, owlNS + 'sameAs', uri);
            }
          }
        }
      }
    });

    triples.end(function(err, result) {
      if (!err)
        fs.writeFileSync(outputTurtle, result);
    })
  })