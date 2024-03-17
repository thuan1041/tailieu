const express = require('express');
const multer = require('multer')
const app = express()

const data = require('./data')
console.log(data)
const aws = require('aws-sdk');
require('dotenv').config()
const path = require('path');
const { access } = require('fs');

process.env.AWS_SDK_JS_SUPPRESS_MAINTANCE_MODE_MESSAGE = '1'

aws.config.update({
    region: process.env.REGION,
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY
})

const s3 = new aws.S3();
const dynamodb = new aws.DynamoDB.DocumentClient();

const bucketName = process.env.S3_BUCKET_NAME
const tableName = process.env.DYNAMODB_TABLE_NAME

const storage = multer.memoryStorage({
    destination(req, file, callback){
        callback(null, '')
    }
})

const upload = multer({
    storage,
    limits: {
        fileSize: 2000000
    },
    fileFilter(req,file,cb){
        checkFileType(file,cb)
    }
})

function checkFileType(file, cb){
    const fileTypes = '/jpeg|jpg|png|gif/'
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase())
    const minetype = fileTypes.test(file.minetype)

    if(extname && minetype){
        return cb(null, true)
    }
    return cb('Error: Image Only!')
}

app.use(express.static('./templates'))
app.set('view engine', 'ejs')
app.set('views', './templates')

app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res)=>{
    return res.render('index', {data})
})

app.post('/add', upload.fields([]) ,(req, res)=>{
    const {id, name, course_type, semester, department} = req.body
    const image = "https://upload.wikimedia.org/wikipedia/commons/9/9d/Tomato.png"
    const newCours = {id, name, course_type, semester, department, image}
    data.push(newCours)
    res.redirect('/')
})

// delete 
app.post('/delete', upload.fields([]), (req, res)=>{
    const checkedList = req.body.checked
    if(checkedList){
        for(i=0; i<checkedList.length;i++){
            for(j=0;j<data.length;j++){
                if(data[j].id == checkedList[i]){
                    data.splice(j,1)
                }
            }
        }
    }
    res.redirect('/')
})
app.listen(3000, ()=>{
    console.log('Server is running on port 3000')
})