# Indonesian Administrative Divisions as Linked Data

Having a common vocabulary for identifying places in Indonesia is essential for synergising development efforts across multiple stakeholders. However, at present, different organizations refer to the same places by different names. Additionally, existing efforts to identify places in Indonesia, such as those identified by GeoNames, are generally incomplete and may not reflect the actual structure of administrative divisions in Indonesia. Thankfully, through the use of Linked Data, it is possible to align these disparate representations using predicates like `owl:sameAs`.

This repository aims to create a reference for identifying administrative divisions in Indonesia for use in Linked Data applications, such as BenangMerah. To create such a reference, four things are needed:

1. An ontology to define the semantics of Indonesian administrative divisions
2. A script to generate an RDF graph from external sources, using vocabulary from the ontology
3. The resulting RDF graph
4. A script for mapping concepts between this ontology and other ontologies/linked data sources
5. A mappings RDF graph

Currently the first 3 points have been developed and are present in this repository. For the external data sources, the current approach being taken is to fetch data from Kemdagri's (the Indonesian Interior Ministry) master reference.

## Ontology

A custom (i.e., not directly based on any other ontology) OWL ontology (Tbox) is used to describe the concepts needed to describe administrative divisions in Indonesia. OWL classes are used represent the classes of administrative divisions: Provinsi, Kabupaten, Kota, Kecamatan, Distrik, Desa, Kelurahan, etc. OWL object properties are used to denote the parent-child relationships in the hierarchy of administrative divisions.

At the moment, the ontology is available in Turtle format [from this repository](https://raw.githubusercontent.com/benangmerah/wilayah/master/ontology.ttl). However, in the future, the BenangMerah ontology will be split off into a different repo. The URIs used will stay the same.

## How it works

The instances RDF graph (Abox) is generated using a custom node.js script from a CSV extracted using [Tabula](http://tabula.nerdpower.org/) from the PDF of [Buku Induk Kode dan Wilayah Administrasi Pemerintahan Per Provinsi, Kabupaten/Kota dan Kecamatan Seluruh Indonesia](http://www.kemendagri.go.id/pages/data-wilayah), which was legalised as _Lampiran I Permendagri No. 18/2013_, with several mistruncated words corrected based on information on the document itself, as well as abbreviations expanded.

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

The instances RDF graph is available in Turtle format [from the repository](https://raw.githubusercontent.com/benangmerah/idn-adm-div-ont/master/instances.ttl).

# About BenangMerah
BenangMerah is a project to connect information on social development in Indonesia into a knowledge base using Semantic Web technologies.

BenangMerah is developed by Andhika Nugraha, a student at Institut Teknologi Bandung.