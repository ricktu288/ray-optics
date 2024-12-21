# Run this project locally

## For developers

If you are a developer and familiar with Node.js and npm, you may want to follow the [Installation Guide](https://github.com/ricktu288/ray-optics?tab=readme-ov-file#installation) instead, which not only allows you to run the project locally, but also allows you to see and modify the source code.

The non-technical guide below will not allow you to see the actual source code.

## For non-developers

If you are not familiar with the development environment but still want to run the project locally, you can follow the steps below.

1. Download and install [Simple Web Server](https://simplewebserver.org/).
2. Download the [latest deployment of this project](https://github.com/ricktu288/ray-optics/archive/refs/heads/gh-pages.zip) or the latest release (see below) and unzip it.
3. Start Simple Web Server, click "New Server".
4. Set "Folder Path" to the "ray-optics-gh-pages" folder you just unzipped. Note that some systems may put the folder in another folder with the same name. Please select the inner one.
5. Expand "Basic Options" and turn on "Exclude .html extension". It should look like this:

    ![Simple Web Server](https://raw.githubusercontent.com/ricktu288/ray-optics/refs/heads/master/run-locally/simple-web-server-config.png)

6. Click "Create server" to run the project.
7. Open the browser and go to http://localhost:8080/ to see the project. Note that the entire site of https://phydemo.app/ray-optics/ is now served locally on your own computer, including the simulator, gallery, and modules.
8. Now every time you want to run the project, just start Simple Web Server, make sure that "ray-optics-gh-pages" is running, and open the browser to http://localhost:8080/.

    ![Simple Web Server](https://raw.githubusercontent.com/ricktu288/ray-optics/refs/heads/master/run-locally/simple-web-server-running.png)

9. To update the project, simply download again the [latest deployment](https://github.com/ricktu288/ray-optics/archive/refs/heads/gh-pages.zip), unzip it, and replace the "ray-optics-gh-pages" folder with the new one.

Note that if your local version is outdated, and you try to open a scene created with a newer version and uses new features, the scene in the outdated simulator may function incorrectly without warning.

## Run the released version

This project has DOI on Zenodo, but the versioned DOIs are only available for the released versions. If you are strict about versioning and want to use the exact version of this project associated with a DOI, then instead of downloading the latest deployment, you can download the latest release instead. The latest release `v5.0` is associated with the DOI `10.5281/zenodo.14538565`, and you can download the deployment [here](https://github.com/ricktu288/ray-optics/archive/refs/heads/release/v5.0.zip) and follow the steps above. However, note that there is no special meaning for the "release" compared with regular deployments, and can also become outdated (see above). The only differences are that it has a versioned DOI and does not contain beta features.