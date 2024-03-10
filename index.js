const  express = require('express')
var data = require('./store')
const multer = require('multer')
const app = express()
// const upload = multer()

// v2
const AWS = require('aws-sdk');
require('dotenv').config();
const path = require('path');
const { on } = require('events');

// cấu hình aws sdk để truy cập vào cloud aws thông qua tài khoản iam user
process.env.AWS_SDK_JS_SUPPRESS_MAINTANCE_MODE_MESSAGE = '1'

AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const bucketName = process.env.S3_BUCKET_NAME
const tableName = process.env.DYNAMODB_TABLE_NAME

// cấu hình multer quản lí upload image
const storage = multer.memoryStorage({
  destination(req, file, callback){
    callback(null, '')
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 2000000}, // cho phép tối đa 2MB
  fileFilter(req,file,cb){
    checkFileType(file,cb)
  }
})

function checkFileType(file, cb){
  const fileTypes = /jpeg|jpg|png|gif/;

  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const minetype = fileTypes.test(file.mimetype); 
  if(extname && minetype){
    return cb(null, true)
  } return cb('Error: Image Only!')
}

// index
app.use(express.static('./templates'))
app.set('view engine', 'ejs')
app.set('views','./templates')

app.use(express.urlencoded({ extended: true }));
// render data lên trang index.ejs từ mảng data lấy từ cloud aws
// app.get('/', (req,res)=>{
//     return res.render('index', {data :data})
// })

app.get("/", async (req,res)=>{
  try {
    const params = {
      TableName:tableName
    }
    const data = await dynamodb.scan(params).promise()
    console.log("dataItems", data.Items)
    console.log("link image", data.Items[0].image)
    return res.render('index', {data:data.Items})
  } catch (error) {
    return res.status(500).send("Internal Server Error")
  }
})

app.post('/save', upload.single('image'), async (req,res)=>{
  try {
    const id = Number(req.body.id);
    const name = req.body.name;
    const course_type = req.body.course_type;
    const semester = req.body.semester;
    const department = req.body.department;
    // console.log(id, name, course_type, semester, department)
    const image = req.file?.originalname.split(".")
    const fileType = image[image.length - 1]
    const filePath = `${id}_${Date.now().toString()}.${fileType}`
    console.log(filePath)
    const paramsS3 = {
      Bucket: bucketName,
      Key: filePath,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }
    s3.upload(paramsS3, async(err, data) => {
      if(err){
        return res.send("Error upload to S3", err)
      } else{
        const imageURL = data.Location
        const paramsDynamoDB = {
          TableName : tableName,
          Item :{
            id: id,
            name: name,
            course_type: course_type,
            semester: semester,
            department: department,
            image: imageURL
          }
        }
        await dynamodb.put(paramsDynamoDB).promise()
        return res.redirect('/')
      }

    })
  } catch (error) {
    return res.send("Error", error)
  }
})

app.post('/delete', upload.fields([]) ,async (req,res)=>{
  var checked = req.body.checked
  if(!Array.isArray(checked)){
    checked = [checked]
  }
  console.log("-=========================",checked)
  if(!checked){
    return res.redirect('/')
  }
  try {
    function onDeleteItem(length){
      const params = {
        TableName: tableName,
        Key: {
          id: Number(checked[length])
        }
      }

      dynamodb.delete(params, (err, data) => {
        if(err){
          console.log("Error", err)
          return res.send("Error", err)
        }  else if(length > 0){
          onDeleteItem(length - 1)
        } else {
          return res.redirect('/')
        }
      })
    }
    onDeleteItem(checked.length - 1)
  } catch (error) {
    return res.send("Error", error)
  }
})

app.listen(4000, ()=>{
    console.log("server is running on port 4000")
})