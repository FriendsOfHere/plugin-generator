/*
 * This file is part of <%= pluginIdentifier %>.
 *
 * Copyright (c) <%= year %> <%= authorName %>.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

function updateData() {

    //miniWindow    
    here.setMiniWindow({ title: "Hello MiniWindow" })

    // Menu Bar
    here.setMenuBar({ title: "Hello MenuBar"})

    // Dock
    here.setDock({ title: "Hello Dock" })
        
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
