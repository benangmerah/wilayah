# Indonesian Administrative Divisions as Linked Data

This repository holds an OWL ontology and knowledge base that attempts to reflect the official, current administrative division structure in Indonesia. The current approach being taken is to fetch data from Kemdagri's (the Indonesian Interior Ministry) master reference and build an ontology model based on that. There will also be mappings to other ontologies, such as GeoNames, schema.org, etc. The OWL files are stored in the Turtle syntax.

## Ontology

The OWL ontology (Tbox) is available in Turtle format [from the repository](https://raw.githubusercontent.com/benangmerah/wilayah/master/ontology.ttl). At present, the ontology describes the four levels of administrative divisions in Indonesia: Provinsi, Kabupaten/Kota, Kecamatan/Distrik, and Desa/Kelurahan and the parent/child relationships between them.

## Knowledge base

The OWL knowledge base (Abox) is generated using a custom node.js script from a CSV extracted using [Tabula](http://tabula.nerdpower.org/) from the PDF of [Buku Induk Kode dan Wilayah Administrasi Pemerintahan Per Provinsi, Kabupaten/Kota dan Kecamatan Seluruh Indonesia](http://www.kemendagri.go.id/pages/data-wilayah), which was legalised as _Lampiran I Permendagri No. 18/2013_, with several mistruncated words corrected based on information on the document itself, as well as abbreviations expanded.

Note that the Permendagri does not include recent establishments of new divisions, such as the province of Kalimantan Utara and many kabupatens around Indonesia. Nonetheless, this knowledgebase uses the Permendagri as its basis. Other possible sources, such as <http://kodepos.nomor.net/>, will be incorporated in the future.

The knowledge base assigns URIs to each administrative division in the following format:
```
http://benangmerah.net/place/idn/[provinsi]/[kabupaten-kota]/[kecamatan]
```

Where:
* `provinsi` is the `slugified-name` of the province, according to the Permendagri. Note that:
  * Daerah Istimewa Yogyakarta, referred as Daista Yogyakarta in the Permendagri, is written as `daerah-istimewa-yogyakarta`, not `daista-yogyakarta`, `yogyakarta`, nor `diy`.
  * DKI Jakarta, on the other hand, is written as `dki-jakarta`, not `daerah-khusus-ibukota-jakarta`, `jakarta`, nor `dki`.
  * Aceh is written as `aceh`, as it is its official name according to UU No. 11/2006
* `kabupaten-kota` is the `slugified-name` of the kabupaten/kota, _including_ the word `kabupaten` or `kota`. The abbreviation Kab. in the Permendagri is expanded. Note that the subdivisions of DKI Jakarta are officially termed "Kota Administratif" and "Kabupaten Administratif".
* `kecamatan` is the `slugified-name` of the kecamatan/distrik, _not including_ the word `kecamatan` nor `distrik`.

At the moment, the `slugified-name` form of place names are generated using [underscore.string](https://github.com/epeli/underscore.string).

Each resource is `rdfs:label`-ed by its name according to the Permendagri.

The OWL ontology (schema, if you may) is available in Turtle format [from the repository](https://raw.githubusercontent.com/benangmerah/idn-adm-div-ont/master/instances.ttl).

# About BenangMerah
BenangMerah is a project to connect information on social development in Indonesia into a knowledge base using Semantic Web technologies.

BenangMerah is developed by Andhika Nugraha, a student at Institut Teknologi Bandung.