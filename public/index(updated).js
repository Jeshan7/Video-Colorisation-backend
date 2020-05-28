const express = require("express");
const multer = require("multer");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const cors = require("cors");
var x = 1;

const app = express();

app.use(cors());

const storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: function (req, file, cb) {
    cb(null, "video.mp4");
  },
});

const upload = multer({
  storage: storage,
  // fileFilter: function (req, file, cb) {
  //   checkFileType(file, cb);
  // }, 
}).single("file");

// // Check File Type
// function checkFileType(file, cb) {
//   // Allowed ext
//   const filetypes = /mp4/;
//   // Check ext
//   const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
//   // Check mime
//   const mimetype = filetypes.test(file.mimetype);

//   if (mimetype && extname) {
//     return cb(null, true);
//   } else {
//     cb("Error: Videos Only!");
//   }
// }

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Hello",
  });
});

app.post("/upload", upload, (req, res) => {
  try {
    const filename = req.file.filename;
    uploadToDrive(filename);
    res.status(200).json({ message: "Success" });
  } catch (e) {
    res.status(200).json({ messge: e.message });
  }
});

app.get("/download", (req, res) => {
  try
  {
    uploadToDrive("download")
     res.status(200).json({message: "File Downloaded"})
  }
   catch(e){
    res.status(404).json({message: e.message})
   }
  
});

const uploadToDrive = (file) => {
  let z = null;
  const SCOPES = ["https://www.googleapis.com/auth/drive"];
  const TOKEN_PATH = "token.json";
  // Load client secrets from a local file.
  fs.readFile("credentials.json", (err, content) => {
    if (err) return console.log("Error loading client secret file:", err);
    authorize(JSON.parse(content));
  });

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function authorize(credentials) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      // if (err) return getAccessToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      if (file === "download") {
        listFiles(oAuth2Client);
      } else {
        uploadFile(oAuth2Client, file);
      }
    });
  }
};

// /**
//  * Get and store new token after prompting for user authorization, and then
//  * execute the given callback with the authorized OAuth2 client.
//  * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
//  * @param {getEventsCallback} callback The callback for the authorized client.
//  */
// function getAccessToken(oAuth2Client, callback) {
//   const authUrl = oAuth2Client.generateAuthUrl({
//     access_type: "offline",
//     scope: SCOPES,
//   });
//   console.log("Authorize this app by visiting this url:", authUrl);
//   const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
//   });
//   rl.question("Enter the code from that page here: ", (code) => {
//     rl.close();
//     oAuth2Client.getToken(code, (err, token) => {
//       if (err) return console.error("Error retrieving access token", err);
//       oAuth2Client.setCredentials(token);
//       // Store the token to disk for later program executions
//       fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
//         if (err) return console.error(err);
//         console.log("Token stored to", TOKEN_PATH);
//       });
//       callback(oAuth2Client);
//     });
//   });
// }

// /**
//  * Lists the names and IDs of up to 10 files.
//  * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
//  */
function listFiles(auth) {
  const drive = google.drive({ version: "v3", auth });
  drive.files.list(
    {
      pageSize: 10,
      q: "name='colorised.avi'",
      fields: "nextPageToken, files(id, name)",
    },
    (err, res) => {
      if (err) 
        {
          throw new Error("No file found")
       } else{
      const files = res.data.files;
      if (files.length) {
        console.log("Files:", files[0].id);
        const fileId = files[0].id;
        getFile(auth, fileId);
      } else {
        throw new Error("No file found")
      }
    }
    }
  );
}

function uploadFile(auth, file) {
  const drive = google.drive({ version: "v3", auth });
  var fileMetadata = {
    name: `video-${x}.mp4`,
  };
  var media = {
    mimeType: "video/mp4",
    body: fs.createReadStream(`./public/uploads/${file}`),
  };
  drive.files.create(
    {
      resource: fileMetadata,
      media: media,
      fields: "id",
    },
    function (err, res) {
      if (err) {
        throw new Error(err.message);
      } else {
        console.log(res.data.id);
      }
    }
  );
}

function getFile(auth, fileId) {
  const drive = google.drive({ version: "v3", auth });
  var dest = fs.createWriteStream("./public/downloads/video.avi");
  drive.files.get(
    { fileId: fileId, fields: "*", alt: "media" },
    { responseType: "stream" },
    (err, res) => {
      if (err) {
        throw new Error("File download Failed")
      } else {
        res.data.pipe(dest);
        console.log("done");
      }
    }
  );
}

const port = 5000;
app.listen(port, () => console.log(`Server started on port ${port}`));
