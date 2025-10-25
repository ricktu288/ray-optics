# Run this project locally

This guide is for running the web app locally. If you want to call the command-line version of the simulator from programming languages (e.g. Python, Julia), please use the [integration tools](https://github.com/ricktu288/ray-optics/tree/dist-integrations) instead.

## For developers

If you are a developer and familiar with Node.js and npm, you may want to follow the [Installation Guide](https://github.com/ricktu288/ray-optics?tab=readme-ov-file#installation) instead, which not only allows you to run the project locally, but also allows you to see and modify the source code.

The non-technical guide below will not allow you to see the actual source code.

## For non-developers

If you are not familiar with the development environment but still want to run the project locally, you can follow the steps below.

1. Download and install [Simple Web Server](https://simplewebserver.org/).
2. Download either of the following and unzip the folder:
   - [Latest deployment](https://github.com/ricktu288/ray-optics/archive/refs/heads/gh-pages.zip) (same as the online version)
   - [Latest release](https://github.com/ricktu288/ray-optics/releases/latest) (slightly older, no beta features, citable with a DOI)
3. Start Simple Web Server, click "New Server".
4. Set "Folder Path" to the folder you just unzipped. Note that some systems may put the folder in another folder with the same name. Please select the inner one.
5. Expand "Basic Options" and turn on "Exclude .html extension". It should look like this (the folder name depends on which version you downloaded):

    ![Simple Web Server](https://raw.githubusercontent.com/ricktu288/ray-optics/refs/heads/master/run-locally/simple-web-server-config.png)

6. Click "Create server" to run the project.
7. Open the browser and go to http://localhost:8080/ to see the project. Note that the entire site of https://phydemo.app/ray-optics/ is now served locally on your own computer, including the simulator, gallery, and modules.
8. Now every time you want to run the project, just start Simple Web Server, make sure that "ray-optics-gh-pages" is running, and open the browser to http://localhost:8080/.

    ![Simple Web Server](https://raw.githubusercontent.com/ricktu288/ray-optics/refs/heads/master/run-locally/simple-web-server-running.png)

9. To update the project, simply download the latest deployment or release again, unzip it, and replace the folder with the new one.