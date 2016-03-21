'use strict'

function TmsMapping () {
  /**
   * Builds the Material type K lookup table to map accesssion TMS ids to catalog callnumbers used in tmsAccessionToShadowcatCallnumber
   *
   * @param  {function} cb - Nothing returned
   */
  this.populateKLookup = require(`${__dirname}/lib/populate_k_lookup`)
  /**
   * Compare TMS accession ids to shadowcat call numbers and adds a bnumber to the TMS object
   *
   * @param  {function} cb - Nothing returned
   */
  this.tmsAccessionToShadowcatCallnumber = require(`${__dirname}/lib/tms_accession_to_shadowcat_callnumber`)
}

module.exports = exports = new TmsMapping()
