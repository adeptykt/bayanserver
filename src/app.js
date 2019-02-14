const path = require('path')
const favicon = require('serve-favicon')
const compress = require('compression')
const cors = require('cors')
const helmet = require('helmet')
const logger = require('winston')

const feathers = require('@feathersjs/feathers')
const configuration = require('@feathersjs/configuration')
const express = require('@feathersjs/express')
const socketio = require('@feathersjs/socketio')

const prototype = require('./utils/prototype')
const middleware = require('./middleware')
const services = require('./services')
const appHooks = require('./app.hooks')
const channels = require('./channels')

const authentication = require('./authentication')

const seed = require('./seed')

const mongoose = require('./mongoose')

const app = express(feathers())

const cron = require('node-cron')
const exec = require('child_process').exec

// Load app configuration
app.configure(configuration())
// Enable CORS, security, compression, favicon and body parsing
app.use(cors())
app.use(helmet())
app.use(compress())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(favicon(path.join(app.get('public'), 'favicon.ico')))
// Host the public folder
app.use('/', express.static(app.get('public')))

// Set up Plugins and providers
app.configure(express.rest())
app.configure(socketio())

app.configure(mongoose)

app.configure(authentication)

// Set up our services (see `services/index.js`)
app.configure(services)

//app.configure(seed)

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware)

// Set up event channels (see channels.js)
app.configure(channels)

// Configure a middleware for 404s and the error handler
app.use(express.notFound())
app.use(express.errorHandler({ logger }))

app.hooks(appHooks)

function two(s) { return ("0" + s).slice(-2) }
function date(d) { return two(d.getYear()) + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) }
cron.schedule("0 0 1 * * *", () => {
  exec(`"c:\\Program Files\\MongoDB\\Server\\3.4\\bin\\mongodump.exe" --db fserver --out e:\\Dropbox\\backups\\${date(new Date)}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`)
      return
    }
    console.log(`stdout: ${stdout}`)
    console.log(`stderr: ${stderr}`)
  })
})

console.log('\nRunning under Node.js version ' + process.versions.node + ' on ' + process.arch + '-type processor, ' + process.platform + ' platform.')

module.exports = app
