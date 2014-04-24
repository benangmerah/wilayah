# Indonesian Administrative Divisions as Linked Data

Having a common vocabulary for identifying places in Indonesia is essential for synergising development efforts across multiple stakeholders. However, at present, different organizations refer to the same places by different names. Additionally, existing efforts to identify places in Indonesia, such as those identified by GeoNames, are generally incomplete and may not reflect the actual structure of administrative divisions in Indonesia. Thankfully, through the use of Linked Data, it is possible to align these disparate representations using predicates like `owl:sameAs`.

This repository aims to create a reference for identifying administrative divisions in Indonesia for use in Linked Data applications, such as BenangMerah. BenangMerah uses this data to link places in Indonesia with statistics about the places as well as social projects and organizations active in those places.

The contents of this repository are as follows:

1. A script to generate RDF triples from reference documents, using node.js.
2. Reference documents to generate the triples from.
3. The resulting RDF triples, in Turtle format.

Additionally, a set of URI conventions are used to identify the Indonesian administrative divisions referenced in the triples. They are described in this readme.

## Ontology

A custom (i.e., not directly based on any other ontology) OWL ontology (Tbox) is used to describe the concepts needed to describe administrative divisions in Indonesia. OWL classes are used represent the classes of administrative divisions: Provinsi, Kabupaten, Kota, Kecamatan, Distrik, Desa, Kelurahan, etc. OWL object properties are used to denote the parent-child relationships in the hierarchy of administrative divisions.

At the moment, the ontology is available in Turtle format [from this repository](https://raw.githubusercontent.com/benangmerah/wilayah/master/ontology.ttl). However, in the future, the BenangMerah ontology will be split off into a different repo. The URIs used will stay the same.

## How it works

The instances RDF graph (Abox) is generated using a custom node.js script from a CSV extracted using [Tabula](http://tabula.nerdpower.org/) from the PDF of [Buku Induk Kode dan Wilayah Administrasi Pemerintahan Per Provinsi, Kabupaten/Kota dan Kecamatan Seluruh Indonesia](http://www.kemendagri.go.id/pages/data-wilayah), which was legalised as _Lampiran I Permendagri No. 18/2013_, with several mistruncated words corrected based on information on the document itself, as well as abbreviations expanded.

Note that the Permendagri does not include recent establishments of new divisions, such as the province of Kalimantan Utara and many kabupatens around Indonesia. Nonetheless, this knowledgebase uses the Permendagri as its basis. Other possible sources, such as <http://kodepos.nomor.net/>, will be incorporated in the future.

## URIs

URIs are used to identify Linked Data resources, in this case the Indonesian administrative divisions. Since they follow a hierarchy, much like files and directories in a filesystem, a similar way of addressing is used. The base URI pattern is as follows:

```
http://benangmerah.net/place/idn/[provinsi]/[kabupaten-kota]/[kecamatan]
```

Where:
* `provinsi` is the `slugified-name` of the province, according to the Permendagri. Note that:
  * Daerah Istimewa Yogyakarta, referred as Daista Yogyakarta in the Permendagri and DI Yogyakarta by BPS, is written as `di-yogyakarta`, not `daerah-istimewa-yogyakarta`, `daista-yogyakarta`, `yogyakarta`, nor `diy`.
  * DKI Jakarta, on the other hand, is written as `dki-jakarta`, not `daerah-khusus-ibukota-jakarta`, `jakarta`, nor `dki`.
  * Aceh is written as `aceh`, as it is its official name according to UU No. 11/2006.
* `kabupaten-kota` is the `slugified-name` of the kabupaten/kota, _including_ the word `kabupaten` or `kota`. The abbreviation Kab. in the Permendagri is expanded. Note that the subdivisions of DKI Jakarta are officially termed "Kota Administratif" and "Kabupaten Administratif".
* `kecamatan` is the `slugified-name` of the kecamatan/distrik, _not including_ the word `kecamatan` nor `distrik`.

The `slugified-name` form of place names are generated using the `slugify` function of [underscore.string](https://github.com/epeli/underscore.string).

These URI conventions can be compared to other ontologies/resources:
* GeoNames which uses codes for places, appended to the base GeoNames URI.
* DBPedia uses Wikipedia titles.

## The instances graph

Each resource is `rdfs:label`-ed by its name according to the Permendagri.

The instances RDF graph is available in Turtle format [from this repository](https://raw.githubusercontent.com/benangmerah/wilayah/master/instances.ttl).

# About BenangMerah

BenangMerah is an effort to collect data on social development in Indonesia into a knowledge base based on Semantic Web/Linked Data technologies.

BenangMerah is developed by Andhika Nugraha, a student at Institut Teknologi Bandung.