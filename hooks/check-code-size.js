#!/usr/bin/env node
/**
 * Check Code Size Hook（兼容入口，实现已并入 hooks/check-edited-file.js）
 */
'use strict'

const { checkEditedFile, runCli } = require('./check-edited-file')
const run = raw => checkEditedFile(raw, false, true)
module.exports = { run }
if (require.main === module) runCli(run)
