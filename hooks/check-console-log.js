#!/usr/bin/env node
'use strict'

// Preserve the standalone and require().run entry points for existing callers.
const { checkEditedFile, runCli } = require('./check-edited-file')
const run = raw => checkEditedFile(raw, true, false)

module.exports = { run }
if (require.main === module) runCli(run)
