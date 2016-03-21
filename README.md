# mapping-tms
Map resources from TMS to MMS/Catalog

####populateKLookup
Builds a lookup table in registry-ingest (shadowcatMaterialKLookup) which holds possible matches for an acquisition Number or call Number map to shadowcat

####tmsAccessionToShadowcatCallnumber
Uses the shadowcatMaterialKLookup table to match TMS objects to shadowcat bnumbers and updates tmsObjects with `bNumber`

####mmsItemsToTmsObjects
Matches mmsItems and mmsCollections to tmsOBjects by matching bnumbers. It looks at the mms collection level and loops through all items trying to find a good title match for that tms object. It will then update the mmsItems and tmsObjects with

```
matchedTms: true,
matchedTmsType: 'title',
tmsId: 12345
--
matchedMms: true,
matchedMmsType: 'title',
mmsUuid: '0d75e9fc-efb5-11e5-9ce9-5e5517507c66'
```

If it cannot match to the mms item level it will put that info into the mmsCollection level as:

```
"tmsUnmatchedChildren" : [ 76137, 76146 ]
```
This can be used to merge in TMS objects as children of MMS collections.