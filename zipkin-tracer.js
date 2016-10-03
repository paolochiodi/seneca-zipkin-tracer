
var Tracer = require('zipkin-simple')
Tracer.options({
  host: '127.0.0.1',
  port: 9411
})

function internal_action (msg) {
  return msg.role === 'seneca' ||
    msg.role === 'transport' ||
    msg.role === 'options' ||
    msg.role === 'mesh' ||
    msg.init
}

function client_inward (ctx, msg) {
  var service = ctx.seneca.private$.optioner.get().tag
  var pin = msg.meta$.pattern

  var trace_data = Tracer.get_child(ctx.seneca.fixedargs.__tracer__)
  Tracer.client_send(trace_data, {
    service: service,
    name: pin
  })

  ctx.__tracer__ = ctx.seneca.fixedargs.__tracer__ = trace_data
}

function server_inward (ctx, msg) {
  var service = ctx.seneca.private$.optioner.get().tag
  var pin = msg.meta$.pattern
  var trace_data = Tracer.get_data(msg.__tracer__)

  Tracer.server_recv(trace_data, {
    service: service,
    name: pin
  })

  ctx.__tracer__ = msg.__tracer__ = ctx.seneca.fixedargs.__tracer__ = trace_data
}

function client_outward (ctx, msg) {
  var service = ctx.seneca.private$.optioner.get().tag
  var pin = msg.meta$.pattern
  var trace_data = ctx.__tracer__

  Tracer.client_recv(trace_data, {
    service: service,
    name: pin
  })
}

function server_outward (ctx, msg) {
  var service = ctx.seneca.private$.optioner.get().tag
  var pin = msg.meta$.pattern
  var trace_data = ctx.__tracer__

  Tracer.server_send(trace_data, {
    service: service,
    name: pin
  })
}

function zipkin_inward (ctx, data) {
  if (internal_action(data.msg)) {
    return
  }

  var msg = data.msg
  if (msg.transport$) {
    return server_inward(ctx, msg)
  }

  client_inward(ctx, msg)
}

function zipkin_outward (ctx, data) {
  if (internal_action(data.msg)) {
    return
  }

  if (!ctx.__tracer__) {
    return
  }

  var msg = data.msg
  if (msg.transport$) {
    return server_outward(ctx, msg)
  }

  client_outward(ctx, msg)
}

function tracer_plugin (options) {
  Tracer.options(options.zipkin)
  var seneca = this

  seneca.inward(zipkin_inward)
  seneca.outward(zipkin_outward)
}

module.exports = tracer_plugin
