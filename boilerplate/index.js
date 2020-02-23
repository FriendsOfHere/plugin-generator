/*
 * This file is part of <%= pluginIdentifier %>.
 *
 * Copyright (c) <%= year %> <%= authorName %>.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

const _ = require("lodash")
const net = require("net")

function updateData() {

<% if (renderComponents.includes('mini')) { %>    //miniWindow    
  here.setMiniWindow({ title: "Hello MiniWindow", detail: "This is a demo here plugin" })<% } %>
<% if (renderComponents.includes('menuBar')) { %>    // Menu Bar
  here.setMenuBar({ title: "Hello Menu Bar"})<% } %>
<% if (renderComponents.includes('dock')) { %>    // Dock
  here.setDock({
    title: "Hello",
    detail: "Dock"
  })<% } %>

}

here.onLoad(() => {
  updateData()
  // Update every 2 hours
  setInterval(updateData, 2*3600*1000);
})

net.onChange((type) => {
  console.log("Connection type changed:", type)
  if (net.isReachable()) {
    updateData()
  }
})
