const { describe, it, expect } = global

const plugin = require('../')

const Client = require('@bugsnag/core/client')
const Report = require('@bugsnag/core/report')
const VALID_NOTIFIER = { name: 't', version: '0', url: 'http://' }

describe('plugin: inline script content', () => {
  it('should add a beforeSend callback which captures the HTML content if file=current url', () => {
    const scriptContent = `function BadThing() {
  Error.apply(this, args)
}
BadThing.prototype = Object.create(Error.prototype)
bugsnagClient.notify(new BadThing('Happens in script tags'))`
    const document = {
      scripts: [ { innerHTML: scriptContent } ],
      currentScript: { innerHTML: scriptContent },
      documentElement: {
        outerHTML: `<p>
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
</p>
<script>${scriptContent}
</script>
<p>more content</p>`
      }
    }
    const window = { location: { href: 'https://app.bugsnag.com/errors' } }

    const client = new Client(VALID_NOTIFIER)
    const payloads = []
    client.setOptions({ apiKey: 'API_KEY_YEAH' })
    client.configure()
    client.use(plugin, document, window)

    expect(client.config.beforeSend.length).toBe(1)
    client.delivery(client => ({ sendReport: (payload) => payloads.push(payload) }))
    client.notify(new Report('BadThing', 'Happens in script tags', [
      { fileName: window.location.href, lineNumber: 10 }
    ]))
    expect(payloads.length).toEqual(1)
    expect(payloads[0].events[0].stacktrace[0].code).toBeDefined()
    expect(payloads[0].events[0].metaData.script).toBeDefined()
    expect(payloads[0].events[0].metaData.script.content).toEqual(scriptContent)
  })

  it('calls the previous onreadystatechange handler if it exists', done => {
    const prevHandler = () => { done() }
    const document = { documentElement: { outerHTML: '' }, onreadystatechange: prevHandler }
    const window = { location: { href: 'https://app.bugsnag.com/errors' }, document }
    const client = new Client(VALID_NOTIFIER)
    client.setOptions({ apiKey: 'API_KEY_YEAH' })
    client.configure()
    client.use(plugin, document, window)
    // check it installed a new onreadystatechange handler
    expect(document.onreadystatechange === prevHandler).toBe(false)
    // now check it calls the previous one
    document.onreadystatechange()
  })

  it('does no wrapping of global functions when disabled', () => {
    const document = { documentElement: { outerHTML: '' } }
    const addEventListener = function () {}
    const window = { location: { href: 'https://app.bugsnag.com/errors' }, document }
    function EventTarget () {}
    EventTarget.prototype.addEventListener = addEventListener
    window.EventTarget = EventTarget
    const client = new Client(VALID_NOTIFIER)
    client.setOptions({ apiKey: 'API_KEY_YEAH', trackInlineScripts: false })
    client.configure()
    client.use(plugin, document, window)
    // check the addEventListener function was not wrapped
    expect(window.EventTarget.prototype.addEventListener).toBe(addEventListener)
  })

  it('truncates script content to a reasonable length', () => {
    let scriptContent = ``
    for (let i = 0; i < 10000; i++) {
      scriptContent += `function fn_${i} (arg0, arg1, arg2) {\n`
      scriptContent += `  console.log('this is an awfully long inline script!')\n`
      scriptContent += `}\n`
    }
    expect(scriptContent.length > 500000).toBe(true)
    const document = {
      scripts: [ { innerHTML: scriptContent } ],
      currentScript: { innerHTML: scriptContent },
      documentElement: {
        outerHTML: `<p>
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
</p>
<script>${scriptContent}
</script>
<p>more content</p>`
      }
    }
    const window = { location: { href: 'https://app.bugsnag.com/errors' } }

    const client = new Client(VALID_NOTIFIER)
    const payloads = []
    client.setOptions({ apiKey: 'API_KEY_YEAH' })
    client.configure()
    client.use(plugin, document, window)

    expect(client.config.beforeSend.length).toBe(1)
    client.delivery(client => ({ sendReport: (payload) => payloads.push(payload) }))
    client.notify(new Report('BadThing', 'Happens in script tags', [
      { fileName: window.location.href, lineNumber: 10 }
    ]))
    expect(payloads.length).toEqual(1)
    expect(payloads[0].events[0].stacktrace[0].code).toBeDefined()
    expect(payloads[0].events[0].metaData.script).toBeDefined()
    expect(payloads[0].events[0].metaData.script.content.length).toBe(500000)
  })

  it('truncates surrounding code lines to a reasonable length', () => {
    const longMessage = Array(1000).fill('jim').join(',')
    const scriptContent = `function fn (arg0, arg1, arg2) {
  console.log('${longMessage}')
}`
    expect(longMessage.length > 200).toBe(true)
    const document = {
      scripts: [ { innerHTML: scriptContent } ],
      currentScript: { innerHTML: scriptContent },
      documentElement: {
        outerHTML: `<p>
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
</p>
<script>${scriptContent}
</script>
<p>more content</p>`
      }
    }
    const window = { location: { href: 'https://app.bugsnag.com/errors' } }

    const client = new Client(VALID_NOTIFIER)
    const payloads = []
    client.setOptions({ apiKey: 'API_KEY_YEAH' })
    client.configure()
    client.use(plugin, document, window)

    expect(client.config.beforeSend.length).toBe(1)
    client.delivery(client => ({ sendReport: (payload) => payloads.push(payload) }))
    client.notify(new Report('BadThing', 'Happens in script tags', [
      { fileName: window.location.href, lineNumber: 7 }
    ]))
    expect(payloads.length).toEqual(1)
    expect(payloads[0].events[0].stacktrace[0].code).toBeDefined()
    const surroundingCode = payloads[0].events[0].stacktrace[0].code
    Object.keys(surroundingCode).forEach(line => {
      expect(surroundingCode[line].length > 200).toBe(false)
    })
    expect(payloads[0].events[0].metaData.script).toBeDefined()
  })
})
