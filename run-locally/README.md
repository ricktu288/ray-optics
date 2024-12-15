# Run this project locally

## For developers

If you are a developer and familiar with Node.js and npm, you may want to follow the [Installation Guide](https://github.com/ricktu288/ray-optics?tab=readme-ov-file#installation) instead, which not only allows you to run the project locally, but also allows you to see and modify the source code.

The non-technical guide below will not allow you to see the actual source code.

## For non-developers

If you are not familiar with the development environment but still want to run the project locally, you can follow the steps below.

1. Download and install [Simple Web Server](https://simplewebserver.org/).
2. Download the [latest deployment of this project](https://github.com/ricktu288/ray-optics/archive/refs/heads/gh-pages.zip) and unzip it.
3. Start Simple Web Server, click "New Server".
4. Set "Folder Path" to the "ray-optics-gh-pages" folder you just unzipped. Note that some systems may put the folder in another folder with the same name. Please select the inner one.
5. Expand "Basic Options" and turn on "Exclude .html extension". It should look like this:

    ![Simple Web Server](https://raw.githubusercontent.com/ricktu288/ray-optics/refs/heads/master/run-locally/simple-web-server-config.png)

6. Click "Create server" to run the project.
7. Open the browser and go to http://localhost:8080/ to see the project. Note that the entire site of https://ricktu288.github.io/ray-optics/ is now served locally on your own computer, including the simulator, gallery, and modules.
8. Now every time you want to run the project, just start Simple Web Server, make sure that "ray-optics-gh-pages" is running, and open the browser to http://localhost:8080/.

    ![Simple Web Server](https://raw.githubusercontent.com/ricktu288/ray-optics/refs/heads/master/run-locally/simple-web-server-running.png)

9. To update the project, simply download again the [latest deployment](https://github.com/ricktu288/ray-optics/archive/refs/heads/gh-pages.zip), unzip it, and replace the "ray-optics-gh-pages" folder with the new one.
