var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var dns = require("dns");
try {
  var mongoose = require("mongoose");
} catch (e) {
  console.log(e);
}
// require and use "multer"...
var multer = require('multer');

var Schema = mongoose.Schema;
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.get("/_api/is-mongoose-ok", function(req, res) {
  if (mongoose) {
    res.json({ isMongooseOk: !!mongoose.connection.readyState });
  } else {
    res.json({ isMongooseOk: false });
  }
});
/** 1) Meet the node console. */
console.log("Hello World");

// Create Schema and Model

/** 2) A first working Express Server */
app.use(function(req, res, next) {
  console.log(req.method + " " + req.path + " - " + req.ip);
  next();
});

/** 3) Serve an HTML file */
app.get("/", function(req, res) {
  var absolutePath = __dirname + "/views/index.html";
  res.sendFile(absolutePath);
});

// Get now time
app.get(
  "/now",
  function(req, res, next) {
    var time = new Date().toString();
    req.time = time;
    next();
  },
  function(req, res) {
    res.json({ time: req.time });
  }
);

// Get Request Params
app.get("/:word/echo", function(req, res) {
  var routeParam = req.params.word;
  res.json({ echo: routeParam });
});

/** 4) Serve static assets  */
var assetPath = __dirname + "/public";

app.use(express.static(assetPath));

/** 5) serve JSON on a specific route */
app.get("/json", function(req, res) {
  if (process.env.MESSAGE_STYLE == "uppercase") {
    res.json({ message: "HELLO JSON" });
  } else {
    res.json({ message: "Hello json" });
  }
});

// Empty date handling
app.get("/api/timestamp/", function(req, res) {
  console.log(req.params);

  let date = new Date();
  res.json({ unix: date.getTime(), utc: date.toUTCString() });
});

// Date String MicroService
app.get("/api/timestamp/:date_string", function(req, res) {
  console.log(req.params.date_string);
  var reqDate = req.params.date_string;
  if (reqDate === "") {
    let date = new Date();
    res.json({ utc: date });
  } else if (reqDate !== "") {
    if (reqDate.includes("-")) {
      let myDate = new Date(reqDate);
      console.log("Got Date " + myDate);
      if (myDate == "Invalid Date") {
        res.json({ error: "Invalid Date" });
      } else {
        res.json({ unix: myDate.getTime(), utc: myDate.toUTCString() });
      }
    } else if (!isNaN(reqDate)) {
      let myDate = new Date(parseInt(reqDate));
      console.log("Got Millis " + myDate);
      res.json({ unix: myDate.getTime(), utc: myDate.toUTCString() });
    } else {
      res.json({ error: "Invalid Date" });
    }
  }
});

// Get Request headers
app.get("/api/whoami", (req, res) => {
  //   {"ipaddress":"159.20.14.100","language":"en-US,en;q=0.5",
  // "software":"Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:50.0) Gecko/20100101 Firefox/50.0"}
  res.json({
    ipaddress: req.ip,
    language: req.headers["accept-language"],
    software: req.headers["user-agent"]
  });
});

// URL Shortner
app.post("/api/shorturl/new", (req, res) => {
  dns.lookup();
});


app.post("/_api/mongoose-model", (req, res) => {
  
    var personSchema = new Schema({
      name: { type: String, required: true },
      age: Number,
      favoriteFoods: [String]
    });
    
    console.log(personSchema);
    var Person = mongoose.model("Person", personSchema);
    res.json({Person});
    // console.log(Person);
});

/** 6) Use the .env file to configure the app */

// /name?first=<firstname>&last=<lastname>
app.use(bodyParser.urlencoded({ extended: false }));

app
  .route("/name")
  .get(function(req, res) {
    let result = req.query.first + " " + req.query.last;
    res.json({ name: result });
  })
  .post(function(req, res) {
    let result = req.body.first + " " + req.body.last;
    res.json({ name: result });
  });

// User schema
const UserSchema = new Schema({
  username: {type: String, required: true},
  exercise: [{
    _id: false,
    description: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }]
});

const User = mongoose.model('User', UserSchema);

//Create New User
const newUser = (userName, done) => {
  User.create({username: userName}, (err, success) => {
    if(err) done(err);
    done(null, success);
  });
};

// Creating New User
app.post('/api/exercise/new-user', (req, res) => {
  let username = req.body.username;
  newUser(username, (err, success) => {
    err ? res.send("Error") : res.send({username: success.username, _id: success._id})
  })
});

// Return all users
app.get('/api/exercise/users', (req, res) => {
  User.find({}).select('username _id').exec((err, success) => {
    if(err) console.log(err);
    res.send(success);
  })
})


// Adding new exercise
app.post('/api/exercise/add', (req, res) => {
  
  let {userId, description, duration} = req.body
  
  User.findOneAndUpdate({_id: userId}, {
    $push: {
      exercise: {
        description: description,
        duration: Number(duration),
        date: req.body.date ?
        new Date(req.body.date).toDateString() :
        new Date().toDateString()
      }
    }
  }, {new: true}, (err, success) => {
    if(success == null) {
      res.json("Please make sure all camps were introduced correctly")
    } else {
      res.send({
        _id: success._id,
        description: description,
        duration: Number(duration),
        date: req.body.date ?
        new Date(req.body.date).toDateString() :
        new Date().toDateString(),
        username: success.username
      });
    }
  })
})

// Retrieve users exercise data
app.get('/api/exercise/log', (req, res) => {
  
  let id = req.query.userId;  
  let fromDate = req.query.from !== undefined ? new Date(req.query.from) : null
  let toDate = req.query.to !== undefined ? new Date(req.query.to) : null
  let limit = parseInt(req.query.limit)
  
  User.findOne({_id: id}, (err, success) => {
    
    let count = success.exercise.length;
    
    if(success == null) {
      res.send("User not found")
    } else {
      if(fromDate && fromDate) {
        res.send({
          _id: id,
          username: success.username,
          count: limit || count,
          log: success.exercise.filter(e => e.date >= fromDate && e.date <= toDate)
                            .slice(0, limit || count)
        })
      } else {
        res.send({
          _id: id,
          username: success.username,
          count: limit || count,
          log: success.exercise.slice(0, limit || count)
        })
      }
    }
  })
});

// File upload API 
var upload = multer().single('upfile');

app.post('/api/fileanalyse', upload, (req, res) => {
  if (req.file) {
    const { originalname: name, mimetype: type, size } = req.file;
    res.json({
      name,
      type,
      size
    });
  } else {
    res.json({
      errror: 'Please select a file to upload'
    });
  }
});

// This would be part of the basic setup of an Express app
// but to allow FCC to run tests, the server is already active
/** app.listen(process.env.PORT || 3000 ); */

//---------- DO NOT EDIT BELOW THIS LINE --------------------

module.exports = app;
