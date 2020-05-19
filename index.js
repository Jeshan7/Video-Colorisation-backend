const express = require("express");
const multer = require("multer");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
// const download = require("download-file");
const request = require("request");
// Set The Storage Engine
const storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: function (req, file, cb) {
    cb(null, file.fieldname + path.extname(file.originalname));
  },
});

// Init Upload
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
    uploadToDrive(file);
  },
}).single("uploadedVideo");

// Check File Type
function checkFileType(file, cb) {
  // Allowed ext
  const filetypes = /mp4/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Videos Only!");
  }
}

// Init app
const app = express();

// EJS
app.set("view engine", "ejs");

// Public Folder
app.use(express.static("./public"));

app.get("/", (req, res) => res.render("index", {

}));

app.post("/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      res.render("index", {
        msg: err,
      });
    } else {
      if (req.file == undefined) {
        res.render(
          "index",
          {
            msg: "Error: No File Selected!",
          },
          { path: req.file.path }
        );
      } else {
        res.render("index", {
          msg: "File Uploaded!",
          file: `uploads/${req.file.filename}`,
        });
      }
    }
  });
});

app.get("/download", (req, res) => {
  uploadToDrive("download");
  res.redirect("/upload");
});

const uploadToDrive = (file) => {
  // If modifying these scopes, delete token.json.
  const SCOPES = ["https://www.googleapis.com/auth/drive"];
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  const TOKEN_PATH = "token.json";
  console.log("dds", file);
  // Load client secrets from a local file.
  fs.readFile("credentials.json", (err, content) => {
    if (err) return console.log("Error loading client secret file:", err);
    // Authorize a client with credentials, then call the Google Drive API.
    if (file === "download") {
      authorize(JSON.parse(content), listFiles);
    } else {
      authorize(JSON.parse(content), uploadFile);
    }
    // authorize(JSON.parse(content), getFile);
  });

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getAccessToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
      // let file = listFiles(oAuth2Client);
      // if (file) {
      //  console.log("Faadd", file)
      //   callback(
      //     oAuth2Client,
      //     "0B66-IoTK-_jcRjFvMmZOY2JsWVY0bDdoLVN5enFWeFJZWUJV"
      //   ); //get file
      // }
    });
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });
    console.log("Authorize this app by visiting this url:", authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error("Error retrieving access token", err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log("Token stored to", TOKEN_PATH);
        });
        callback(oAuth2Client);
      });
    });
  }

  /**
   * Lists the names and IDs of up to 10 files.
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  function listFiles(auth) {
    const drive = google.drive({ version: "v3", auth });
    drive.files.list(
      {
        pageSize: 10,
        q: "name='colorised.avi'",
        fields: "nextPageToken, files(id, name)",
      },
      (err, res) => {
        if (err) return console.log("The API returned an error: " + err);
        const files = res.data.files;
        if (files.length) {
          console.log("Files:", files[0].id);
          const fileId = files[0].id;
          getFile(auth, fileId);
        } else {
          console.log("No files found.");
        }
      }
    );
  }

  function uploadFile(auth) {
    const drive = google.drive({ version: "v3", auth });
    var fileMetadata = {
      name: `${file.fieldname}.mp4`,
    };
    var media = {
      mimeType: "video/mp4",
      body: fs.createReadStream(`./public/uploads/${file.fieldname}.mp4`),
    };
    drive.files.create(
      {
        resource: fileMetadata,
        media: media,
        fields: "id",
      },
      function (err, res) {
        if (err) {
          // Handle error
          console.log(err);
        } else {
          console.log("File Id: ", res.data.id);
        }
      }
    );
  }

  function getFile(auth, fileId) {
    console.log(fileId);
    const drive = google.drive({ version: "v3", auth });
    var dest = fs.createWriteStream("./public/downloads/colorised.avi");
    drive.files.get(
      { fileId: fileId, fields: "*", alt: "media" },
      { responseType: "stream" },
      (err, res) => {
        if (err) return console.log("The API returned an error: " + err);
        console.log(res.data);
        res.data.pipe(dest);
      }
    );
  }
};

const port = 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));
