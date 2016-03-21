'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var clc = require('cli-color')
var utils = require('nypl-registry-utils-normalize')

/**
 * Compare TMS accession ids to shadowcat call numbers and adds a bnumber to the TMS object
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function tmsAccessionToShadowcatCallnumber (cb) {
  db.returnCollections({registryIngest: ['shadowcatMaterialKLookup', 'tmsObjects']}, (err, returnCollections) => {
    if (err) console.log(err)
    var shadowcatMaterialKLookup = returnCollections.registryIngest.shadowcatMaterialKLookup
    var tmsObjects = returnCollections.registryIngest.tmsObjects
    var count = 0
    var countFound = 0
    var callLookup = []
    var callObject = {}
    var bNumberLookup = {}

    if (err) console.log(err)

    var updateTmsObjects = (tmsObject, callback) => {
      _(tmsObject.updates)
        .map(_.wrapCallback((update, wrapCallback) => {
          tmsObjects.update({_id: update._id}, { $set: update }, function (err, results) {
            if (err) console.log(err)
            wrapCallback(null, update)
          })
        }))
        .sequence()
        .done(() => {
          callback(null, tmsObject)
        })
    }

    _(shadowcatMaterialKLookup.find({}))
      .map((bib) => {
        if (bib['sc:callnumber']) {
          bib['sc:callnumber'].forEach((c) => {
            if (c.search(/[0-9]+ph/i) > -1) {
              callLookup.push(c)
              bNumberLookup[c] = bib._id
            } else {
              callObject[utils.normalizeAndDiacritics(c)] = 0
              bNumberLookup[utils.normalizeAndDiacritics(c)] = bib._id
            }
          })
        }
        return ''
      })
      .compact()
      .done(() => {
        _(tmsObjects.find({}))
          .map((tmsObject) => {
            process.stdout.cursorTo(0)
            process.stdout.write(clc.black.bgGreenBright('' + ++count + ' | countFound: ' + countFound))
            if (tmsObject.callNumber) {
              var call = utils.normalizeAndDiacritics(tmsObject.callNumber)

              if (typeof callObject[call] !== 'undefined') {
                callObject[call]++
                countFound++
                // add it to the TMS record
                if (bNumberLookup[call]) {
                  var update = {
                    _id: tmsObject._id,
                    bNumber: bNumberLookup[call]
                  }
                  tmsObject.updates = [update]
                  return tmsObject
                }
              }
            }

            if (tmsObject.acquisitionNumber) {
              var a = tmsObject.acquisitionNumber.split('.')[0]

              // bad chars in in acq number
              if (a.search(/\*/) > -1) return ''
              if (a.search(/test/i) > -1) return ''

              try {
                var regex = new RegExp(a, 'gi')
              } catch (e) {
                return ''
              }
              var updates = []

              // callLookup.map(function(calls){
              callLookup.forEach(function (c) {
                if (c.search(regex) > -1) {
                  countFound++
                  var update = {
                    _id: tmsObject._id,
                    bNumber: bNumberLookup[c]
                  }
                  updates.push(update)
                }
              })
              tmsObject.updates = updates
              if (updates.length === 0) return ''
              return tmsObject
            }
            return ''
          })
          .compact() // if a '' was returned (nothing to update or can't update) it is dropped here
          .map(_.curry(updateTmsObjects))
          .nfcall([])
          .parallel(20)
          .done((mmsItem) => {
            console.log('Done tmsAccessionToShadowcatCallnumber')
            if (cb) cb()
          })
      })
  })
}
