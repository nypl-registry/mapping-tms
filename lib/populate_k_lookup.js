'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var clc = require('cli-color')

/**
 * Builds the Material type K lookup table to map accesssion TMS ids to catalog callnumbers
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function populateKLookup (cb) {
  db.prepareRegistryIngestShadowcatMaterialKLookup(() => {
    db.returnCollections({registryIngest: ['shadowcatMaterialKLookup'], shadowcat: ['bib']}, (err, returnCollections) => {
      if (err) console.log(err)
      var shadowcatMaterialKLookup = returnCollections.registryIngest.shadowcatMaterialKLookup
      var bibs = returnCollections.shadowcat.bib
      var count = 0
      var countFound = 0

      if (err) console.log(err)

      var updateLookup = (bib, callback) => {
        shadowcatMaterialKLookup.insert(bib, function (err, results) {
          if (err) console.log(err)
          callback(null, bib)
        })
      }

      _(bibs.find({}, {'sc:callnumber': 1, 'fixedFields.30': 1}).batchSize(10000))
        .map((bib) => {
          count++
          process.stdout.cursorTo(0)
          process.stdout.write(clc.black.bgGreenBright('' + count + ' | countFound: ' + countFound))

          if (bib.fixedFields) {
            if (bib.fixedFields['30']) {
              if (bib.fixedFields['30'].value) {
                if (bib.fixedFields['30'].value.trim() === 'k') {
                  countFound++
                  return bib
                }
              }
            }
          }
          return ''
        })
        .compact()
        .map(_.curry(updateLookup))
        .nfcall([])
        .parallel(20)
        .done((mmsItem) => {
          console.log('Done populateKLookup')
          if (cb) cb()
        })
    })
  })
}
