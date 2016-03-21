'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var clc = require('cli-color')
var utils = require('nypl-registry-utils-normalize')

/**
 * Maps MMS items to TMS Objects based bnumber added in by tmsAccessionToShadowcatCallnumber
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function mmsItemsToTmsObjects (cb) {
  db.returnCollections({registryIngest: ['mmsItems', 'tmsObjects', 'mmsCollections']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsItems = returnCollections.registryIngest.mmsItems
    var tmsObjects = returnCollections.registryIngest.tmsObjects
    var mmsCollections = returnCollections.registryIngest.mmsCollections

    var totalItems = 10000000000
    var count = 0
    var countUpdated = 0
    var alreadyMatched = 0
    var percentDone = 0

    tmsObjects.count({bNumber: {$exists: true}}, (err, result) => {
      if (err) console.log(err)
      totalItems = result
    })

    var selectiveCleanup = function (str) {
      return str.replace(/\[|\]|\n/ig, '').replace(/\s+/g, ' ')
    }

    var checkForTmsObjectMatches = (tmsObject, callback) => {
      if (Math.floor(++count / totalItems * 100) !== percentDone) {
        process.stdout.cursorTo(0)
        process.stdout.write(clc.black.bgYellowBright(`TMS Object Map by Bnumber: ${percentDone}% (${countUpdated} Objects Matched) (${alreadyMatched} Already Matched)`))
        percentDone = Math.floor(count / totalItems * 100)
      }

      if (!tmsObject.bNumber) {
        callback(err, '')
        return false
      }

      mmsCollections.find({ $or: [ {bNumber: tmsObject.bNumber}, {bNumber: 'b' + tmsObject.bNumber} ] }).toArray((err, mmsCollectionsAry) => {
        if (mmsCollectionsAry.length > 0) {
          countUpdated++

          var bestMatch = {}
          var bestScore = -1
          var bestMatchId = false
          var itemCounter = 0

          _(mmsItems.find({ collectionUuid: mmsCollectionsAry[0]._id }))
            .map((mmsItem) => {
              process.stdout.cursorTo(0)
              process.stdout.write(clc.black.bgYellowBright(`TMS Object Map by Bnumber: ${percentDone}% (${countUpdated} Objects Matched) (${alreadyMatched} Already Matched) [${++itemCounter}]`))

              bestMatch[mmsItem._id] = {
                title: mmsItem.title,
                score: selectiveCleanup(tmsObject.title).score(selectiveCleanup(mmsItem.title), 0.5),
                matchedTms: mmsItem.matchedTms
              }
              if (bestMatch[mmsItem._id].score > bestScore) {
                bestMatchId = mmsItem._id
                bestScore = bestMatch[mmsItem._id].score
              }
            })
            .done((mmsItem) => {
              if (bestScore > 0.4) {
                // we are going to update the mms item and TMS object with the mapping
                if (bestMatch[bestMatchId].matchedTms) {
                  alreadyMatched++
                  callback(err, '')
                  return
                }

                // update the MMS collection
                var updateMms = {
                  _id: bestMatchId,
                  matchedTms: true,
                  matchedTmsType: 'title',
                  tmsId: tmsObject._id
                }

                var updateTms = {
                  _id: tmsObject._id,
                  matchedMms: true,
                  matchedMmsType: 'title',
                  mmsUuid: bestMatchId
                }

                mmsItems.update({ _id: updateMms._id }, { $set: updateMms }, function (err, result) {
                  if (err) console.log(err)
                  tmsObjects.update({ _id: updateTms._id }, { $set: updateTms }, function (err, result) {
                    if (err) console.log(err)
                    callback(err, tmsObject)
                  })
                })
              } else {
                // update the mms collection to show that these should be pulled into it at some level
                if (!mmsCollectionsAry[0].tmsUnmatchedChildren) mmsCollectionsAry[0].tmsUnmatchedChildren = []

                mmsCollectionsAry[0].tmsUnmatchedChildren.push(tmsObject._id)
                // console.log('-----------')
                // console.log(tmsObject.title)
                // console.log(bestMatch)

                // console.log('No best match!', mmsCollectionsAry[0]._id)
                // console.log(mmsCollectionsAry[0])

                mmsCollections.update({ _id: mmsCollectionsAry[0]._id }, {$set: {tmsUnmatchedChildren: mmsCollectionsAry[0].tmsUnmatchedChildren}}, function (err, result) {
                  if (err) console.log(err)
                  callback(err, tmsObject)
                })
              }
            })
        } else {
          callback(err, '')
        }
      })
    }

    _(tmsObjects.find({bNumber: {$exists: true}}))
      .map(_.curry(checkForTmsObjectMatches))
      .nfcall([])
      .parallel(20)
      .compact()
      // .map(_.curry(updateTmsMatches))
      // .nfcall([])
      // .parallel(10)
      .done((mmsItem) => {
        console.log('Done')
        if (cb) cb()
      })
  })
}
