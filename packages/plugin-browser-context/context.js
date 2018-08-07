/*
 * Sets the default context to be the current URL
 */
module.exports = {
  name: 'browserContext',
  init: (client, win = window) => {
    client.config.beforeSend.unshift(report => {
      if (report.context) return
      report.context = win.location.pathname
    })
  }
}
