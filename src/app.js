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

// Подключаем новые модули роутов
const partnerRoutes = require('./routes/partner')
const statsRoutes = require('./routes/stats')
const utilsRoutes = require('./routes/utils')
const webhooksRoutes = require('./routes/webhooks')
const cronTasks = require('./jobs/cron-tasks')

const app = express(feathers())

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

// Configure routes
app.configure(partnerRoutes)
app.configure(statsRoutes)
app.configure(utilsRoutes)
app.configure(webhooksRoutes)

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware)

// Set up event channels (see channels.js)
app.configure(channels)

// Configure a middleware for 404s and the error handler
app.use(express.notFound())
app.use(express.errorHandler({ logger }))

app.hooks(appHooks)

// Initialize cron tasks
app.configure(cronTasks)

console.log('\nRunning under Node.js version ' + process.versions.node + ' on ' + process.arch + '-type processor, ' + process.platform + ' platform.')

module.exports = app
