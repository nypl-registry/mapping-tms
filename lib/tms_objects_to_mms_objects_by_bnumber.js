'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var clc = require('cli-color')

/**
 * Maps MMS items to TMS Objects based on tmsObject, tmsId and callNumber if they have not been matched yet
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function mmsItemsToTmsObjects (cb) {
  db.returnCollections({registryIngest: ['mmsItems', 'tmsObjects']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsItems = returnCollections.registryIngest.mmsItems
    var tmsObjects = returnCollections.registryIngest.tmsObjects

    var totalItems = 10000000000
    var count = 0
    var countUpdated = 0
    var percentDone = 0

    mmsItems.count({$or: [{tmsObject: {$exists: true}}, {tmsId: {$exists: true}}, {callNumber: {$exists: true}}]}, (err, result) => {
      if (err) console.log(err)
      totalItems = result
    })

    var checkForTmsObjectMatches = (mmsItem, callback) => {
      if (Math.floor(++count / totalItems * 100) !== percentDone) {
        process.stdout.cursorTo(0)
        process.stdout.write(clc.black.bgYellowBright(`TMS Object Map: ${percentDone}% (${countUpdated} Objects)`))
        percentDone = Math.floor(count / totalItems * 100)
      }
      var tmsObject = (mmsItem.tmsObject) ? mmsItem.tmsObject : -1000
      var tmsId = (mmsItem.tmsId) ? mmsItem.tmsId : -1000
      var callNumber = (mmsItem.callNumber) ? mmsItem.callNumber : -1000

      if (tmsObject === -1000 && tmsId === -1000 && callNumber === -1000) {
        callback(err, '')
        return false
      }

      tmsObjects.find({ $or: [{ objectNumber: tmsObject }, { objectID: parseInt(tmsId) }, { callNumber: callNumber }] }).toArray((err, tmsObjectsAry) => {
        if (tmsObjectsAry.length > 1) {
          console.log('Warning: MMS <-> TMS, multi ident match for: ', 'tms: ' + parseInt(tmsId) + ' or tmsObject: ' + tmsObject + ' or callNumber: ' + callNumber)
        }

        if (tmsObjectsAry.length > 0) {
          countUpdated++
          callback(err, {mmsItem: mmsItem, tmsObjects: tmsObjectsAry})
        } else {
          callback(err, '')
        }
      })
    }

    var updateTmsMatches = (matches, callback) => {
      var allTmsIds = matches.tmsObjects.map((x) => {
        return x._id
      })

      // update the MMS collection
      var updateMms = {
        _id: matches.mmsItem._id,
        matchedTms: true,
        matchedTmsType: 'identifier',
        tmsId: matches.tmsObjects[0]._id,
        allTmsIds: allTmsIds
      }

      var updateTms = {
        matchedMms: true,
        matchedMmsType: 'identifier',
        mmsUuid: matches.mmsItem._id
      }

      mmsItems.update({ _id: updateMms._id }, { $set: updateMms }, function (err, result) {
        if (err) console.log(err)
        tmsObjects.update({ _id: matches.tmsObjects[0]._id }, { $set: updateTms }, function (err, result) {
          if (err) console.log(err)
          callback(err, matches)
        })
      })
    }

    _(mmsItems.find({$or: [{tmsObject: {$exists: true}}, {tmsId: {$exists: true}}, {callNumber: {$exists: true}}]}))
      .map(_.curry(checkForTmsObjectMatches))
      .nfcall([])
      .parallel(20)
      .compact()
      .map(_.curry(updateTmsMatches))
      .nfcall([])
      .parallel(10)
      .done((mmsItem) => {
        console.log('Done')
        if (cb) cb()
      })
  })
}
