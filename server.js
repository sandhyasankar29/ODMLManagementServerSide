const pg = require('pg');
const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const fast2sms = require('fast-two-sms')
const cors = require('cors');
var knex = require('knex');
var nodemailer = require('nodemailer');
var otpGenerator = require('otp-generator')
const { google } = require("googleapis");
const { query } = require('express');
const date = require('date-and-time');
let otp = 'abcd'
const generateOTP = () => { otp = otpGenerator.generate(6, { upperCase: false, specialChars: false }); }
generateOTP()
const OAuth2 = google.auth.OAuth2;
const oauth2Client = new OAuth2(
    '419164085262-tsia15f1698ghin5d0du8svoaa83jfjo.apps.googleusercontent.com',
    'JY342uAw-OCGBFB8Q8hJKvQ8', // Client Secret
    "https://developers.google.com/oauthplayground" // Redirect URL
);
oauth2Client.setCredentials({
    refresh_token: "1//04NifLUD2U7EMCgYIARAAGAQSNwF-L9IrixDQaamg8TXDckYG-h8ICbs6ZzQlIC0ZlNrO5Tb8lN-C_hWlEl__Hz2WzPq7Bd1WQiI"
});
const accessToken = oauth2Client.getAccessToken();

const db = knex({
    client: 'pg',
    connection: {
        host: 'odml.postgres.database.azure.com',
        user: 'shriharinithin@odml',
        password: 'softwaregroup12@',
        database: 'odmlrecords',
        port: 5432,
        ssl: true
    }
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send("Hello World")
})

app.post('/signinstudent', (req, res) => {
    const value = req.body;
    var val = 0;
    val = value.password;
    db.select('suserid', 'password', 'approval').from('student_login')
        .where('suserid', '=', value.suserid)
        .then(data => {
            if (data.length >= 1) {
                if (val == data[0].password && data[0].approval === "APPROVED") {
                    return db('student_details').join('student_login', 'student_details.suserid', 'student_login.suserid').select('*')
                        .where('student_login.suserid', '=', value.suserid)
                        .then(user => {
                            res.json({
                                suserid: value.suserid,
                                firstname: user[0].firstname,
                                lastname: user[0].lastname,
                                status: "Success"
                            });
                        })
                        .catch(err => res.status(400).json({ status: "Fail", reason: "Internal Error" }))
                }
                else {
                    res.status(400).json({ status: "Fail", reason: "Wrong Password" });

                }
            }
            else {
                res.status(400).json({ status: "Fail", reason: "Wrong username or User donot exist" });
            }
        })

})

app.post('/registerstudent', (req, res) => {
    //suserid,firstname,email
    const value = req.body;
    db('student_details').select('*').where('email', '=', value.email)
        .then(user => {
            if (user) {
                res.status(400).json({status:"Email Not Allowed", email:value.email , })
            }
            else {
                db.select('*').from('student_login')
                    .where('suserid', '!=', value.suserid)
                    .then(data => {
                        const accessToken = oauth2Client.getAccessToken()
                        const smtpTransport = nodemailer.createTransport({
                            service: "gmail",
                            auth: {
                                type: "OAuth2",
                                user: "odmldatabaseemailer@gmail.com",
                                clientId: '419164085262-tsia15f1698ghin5d0du8svoaa83jfjo.apps.googleusercontent.com',
                                clientSecret: 'JY342uAw-OCGBFB8Q8hJKvQ8',
                                refreshToken: "1//04NifLUD2U7EMCgYIARAAGAQSNwF-L9IrixDQaamg8TXDckYG-h8ICbs6ZzQlIC0ZlNrO5Tb8lN-C_hWlEl__Hz2WzPq7Bd1WQiI",
                                accessToken: accessToken,
                                tls: {
                                    rejectUnauthorized: false
                                }
                            }
                        });
                        const mailOptions = {
                            from: "odmldatabaseemailer@gmail.com",
                            to: value.email,
                            subject: "odmlManagement System Verification",
                            generateTextFromHTML: true,
                            html: `<p>Welcome ${value.firstname}</p>
                <img src=${'https://cdn.pixabay.com/photo/2016/11/21/15/38/dock-1846008_1280.jpg'} alt="Welcome_img">
                <p>
                    Please Use the Following OTP to Successfully verify !
                    <br />
                </p>
                <b style="font-size:30px">${otp}</b>`
                        };
                        smtpTransport.sendMail(mailOptions, (error, response) => {
                            error ? res.status(400).json("Error in sending Email") : res.status(200).json({ genOTP: otp });
                            smtpTransport.close();
                        })
                    })
            }
        })
        .catch(err => res.status(400).json("Some Unexpected Error"))

        
});

app.delete('/cancelleaverequest', (req, res) => {
    const value = req.body
    const now = new Date(value.dos)
    const day = date.format(now, 'MM/DD/YYYY');
    console.log(value);
    console.log(day);
    db('leave_details').where('suserid', '=', value.suserid).where('dos', '=', day).where('reason', '=', value.reason).del()
        .then(result => {
            res.status(200).json({ status: "Delete success" })
        }).catch(err => {
            console.log(err);
            throw err;
        })
})


app.post('/verifystudent', (req, res) => {
    const value = req.body;
    if (otp == value.otp) {
        db.transaction(trx => {
            trx.insert({
                suserid: value.suserid,
                lastname: value.lastname,
                firstname: value.firstname,
                dob: value.dob,
                roll: value.roll,
                branch: value.branch,
                section: value.section,
                batch: value.batch,
                email: value.email,
                ph_no: value.phnumber,
            }).into("student_details")
                .returning('roll')
                .then(data => {
                    return trx('student_login')
                        .returning('*')
                        .insert({
                            suserid: data[0],
                            password: value.password,
                            approval: "APPROVED"
                        })
                }).then(data => {
                    generateOTP()
                    res.json({ status: "Successfully Registered", tuserid: value.tuserid })
                })
                .then(trx.commit)
                .catch(trx.rollback)
        }).catch(err => res.status(400).json('Unable to register the Given User, This may be due to server or network error'))

    }
    else {
        res.status(400).json("Bad OTP")
    }
});

app.delete('/deletestudent', (req, res) => {
    const value = req.body;
    db('student_details').where('suserid', value.suserid).del().then(result => {
        res.status(200).json({ status: "Delete success" })
    }).catch(err => {
        console.log(err);
        throw err;
    })
})

app.delete('/deletestudentlogin', (req, res) => {
    const value = req.body;
    db('student_login').where('suserid', value.suserid).del().then(result => {
        res.status(200).json({ status: "Delete success" })
    }).catch(err => {
        console.log(err);
        throw err;
    })
})


app.post('/signinteacher', (req, res) => {
    const value = req.body;
    var val = 0;
    val = value.password;
    db.select('tuserid', 'password', 'approval').from('teacher_login')
        .where('tuserid', '=', value.tuserid)
        .then(data => {
            if (data.length >= 1) {
                if (val == data[0].password && data[0].approval === "APPROVED") {
                    return db('teacher_details').join('teacher_login', 'teacher_details.tuserid', 'teacher_login.tuserid').select('*')
                        .where('teacher_login.tuserid', '=', value.tuserid)
                        .then(user => {
                            res.json({
                                tuserid: value.tuserid,
                                firstname: user[0].firstname,
                                lastname: user[0].lastname,
                                status: "Success",
                                approval: data[0].approval,
                                chairperson: user[0].chairperson
                            });
                        })
                        .catch(err => res.status(400).json("Unable to get User"))
                }
                else {
                    res.status(400).json({ reason: "Wrong credentials or Account not Approved", approval: data[0].approval });

                }
            }
            else {
                res.status(400).json("Wrong credentials");
            }
        })

})

app.post('/registerteacher', (req, res) => {
    const value = req.body;
    db('teacher_details').select('*').where('email', '=', value.email)
        .then(user => {
            if (user > 0) {
                res.status(400).json("Email Not Allowed")
            }
            else {
                db.transaction(trx => {
                    trx.insert({
                        tuserid: value.tuserid,
                        lastname: value.lastname,
                        firstname: value.firstname,
                        doj: value.doj,
                        branch: value.branch,
                        email: value.email,
                        ph_no: value.phoneNumber
                    }).into("teacher_details")
                        .returning('tuserid')
                        .then(data => {
                            return trx('teacher_login')
                                .returning('*')
                                .insert({
                                    tuserid: data[0],
                                    password: value.password,
                                    approval: "Pending"
                                })
                        }).then(data => {
                            res.json({ status: "Successfully Registered", tuserid: value.tuserid })
                        })
                        .then(trx.commit)
                        .catch(trx.rollback)
                }).catch(err => res.status(400).json('Unable to register the Given User, This may be due to server or network error'))
            }
        })
        .catch(err => res.status(400).json("Some Unexpected Error"))
})

app.delete('/deleteteacher', (req, res) => {
    const value = req.body;
    db('teacher_details').where('tuserid', value.tuserid).del().then(result => {
        res.status(200).json({ status: "Delete success" })
    }).catch(err => {
        res.status(400).json({ status: "Delete Unsuccesful" });
        console.log(err);
        throw err;
    })
})

app.delete('/deleteteacherlogin', (req, res) => {
    const value = req.body;
    db('teacher_login').where('tuserid', value.tuserid).del().then(result => {
        res.status(200).json({ status: "Delete success" })
    }).catch(err => {
        res.status(400).json({ status: "Delete Unsuccesful" });
        console.log(err);
        throw err;
    })
})

app.get('/teacherleaverecords/:troll', (req, res) => {
    const value = req.params;
    db('leave_details').select('*').where('approval', '=', 'Pending').where('tuserid', '=', value.troll.toUpperCase())
        .then(user => {
            if (user.length) {
                res.json(user)
            }
            else {
                res.status(200).json("No Data Available as of Now")
            }
        })
        .catch(err => res.status(400).json("Some Unexpected Error"))
})


app.get('/chairleaverecords/:dept', (req, res) => {
    const value = req.params;
    db('leave_details').select('*').where('approval', '=', 'Verified').where('branch', '=', value.dept)
        .then(user => {
            if (user.length) {
                res.json(user)
            }
            else {
                res.status(200).json("No Data Available as of Now")
            }
        })
        .catch(err => res.status(400).json("Some Unexpected Error"))
})

app.get('/teachdept/:dept', (req, res) => {
    //'tuserid', 'firstname', 'lastname'
    value = req.params
    db('teacher_details').join('teacher_login', 'teacher_details.tuserid', 'teacher_login.tuserid').select('teacher_details.firstname', 'teacher_details.lastname', 'teacher_details.tuserid').where('teacher_details.branch', '=', value.dept).where('teacher_login.chairperson', '=', 'No')
        .then(user => {
            if (user.length >= 1) {
                res.json(user)
            }
            else {
                res.json("NA")
            }
        }).catch(err => res.json("NA"))
})

app.post('/decisionteacher', (req, res) => {
    //status,suserid,dos
    const value = req.body;
    db('leave_details').where('suserid', '=', value.suserid.toUpperCase()).where("dos", '=', value.dos).select('*')
        .update({
            approval: value.status,
        }).then(a => {
            res.json({ status: "Success", approval: value.status })
        })
})


app.post('/notifystudent', (req, res) => {
    value = req.body;
    db('student_details').select('*').where('suserid', '=', value.suserid).then(user => {
        console.log(user[0].ph_no)
        let msg = `Your Leave Request from ${value.dos} to ${value.doe} for ${value.reason} has been ${value.status}`
        var options = { authorization: 'gEM8ZdaKYrpnvR3h4m9qJUeSP2XFtljAx6DfkC5swNWo0b7VOHJ0Rw5pkhXoNyFnaOAtQbPUf8zZKHeq', message: msg, numbers: [`${user[0].ph_no}`] }
        fast2sms.sendMessage(options).then(data => {
            res.status(200).json("Message Sent Successfully")
        }).catch(err => {
            res.status(400).json("Failed To Send!")
        })
    })
})

app.post('/changepassword', (req, res) => {
    // email , old password ,tuserid
    //.join('teacher_details', 'teacher_login.tuserid', 'teacher_details.tuserid')
    //.where('email', '=', value.email)
    generateOTP()
    const value = req.body;
    console.log(value)
    db('teacher_login').select('*')
        .where('tuserid', '=', value.tuserid)
        .where('password', '=', value.password)
        .then(data => {
            console.log(data)
            if (data.length > 0) {
                const accessToken = oauth2Client.getAccessToken()
                const smtpTransport = nodemailer.createTransport({
                    service: "gmail",
                    auth: {
                        type: "OAuth2",
                        user: "odmldatabaseemailer@gmail.com",
                        clientId: '419164085262-tsia15f1698ghin5d0du8svoaa83jfjo.apps.googleusercontent.com',
                        clientSecret: 'JY342uAw-OCGBFB8Q8hJKvQ8',
                        refreshToken: "1//04NifLUD2U7EMCgYIARAAGAQSNwF-L9IrixDQaamg8TXDckYG-h8ICbs6ZzQlIC0ZlNrO5Tb8lN-C_hWlEl__Hz2WzPq7Bd1WQiI",
                        accessToken: accessToken,
                        tls: {
                            rejectUnauthorized: false
                        }
                    }
                });
                const mailOptions = {
                    from: "odmldatabaseemailer@gmail.com",
                    to: value.email,
                    subject: "odmlManagement System Verification",
                    generateTextFromHTML: true,
                    html: `<p>Welcome,</p>
                        <img src=${'https://exotel.com/wp-content/uploads/2020/02/EXOTEL_nOTP_ANIMATION_SS_v03.gif'} alt="Otp_img">
                        <p>
                            Please Verify Using the Given OTP
                            <br />
                        </p>
                        <b style="font-size:30px">${otp}</b>`
                };
                smtpTransport.sendMail(mailOptions, (error, response) => {
                    error ? console.log(error) : console.log(response);
                    smtpTransport.close();
                })
            }
            else {
                res.status(400).json("Failed")
            }
        }).then(data => {
            res.json('Success Email Sent')
        }).catch(err => res.status(400).json("Fail"))
})


app.post('/verifyteacherotp', (req, res) => {
    //passwordNew,otp,tuserid
    const value = req.body;
    if (otp === value.otp) {
        db('teacher_login').where('tuserid', '=', value.tuserid.toUpperCase()).select('*')
            .update({
                password: value.password,
            }).then(a => {
                generateOTP()
                res.json("Success")
            }).catch(err => {
                res.status(400).json("Wrong user")
            })
    }
    else {
        res.status(400).json("Bad OTP")
    }
});



app.get('/forms', (req, res) => {
    db('teacher_details').join('teacher_login', 'teacher_details.tuserid', 'teacher_login.tuserid').select('teacher_details.*').where('approval', '=', 'Pending')
        .then(user => {
            if (user) {
                res.json(user)
            }
            else {
                res.status(200).json("No Pending Requests")
            }
        })
        .catch(err => res.status(400).json("Some Unexpected Error"))
})

app.get('/detailedforms/:roll', (req, res) => {
    const value = req.params;
    db('teacher_details').select('*').where('tuserid', '=', value.roll.toUpperCase())
        .then(user => {
            if (user.length) {
                res.json(user)
            }
            else {
                res.status(400).json("Invalid Id")
            }
        })
        .catch(err => res.status(400).json("Some Unexpected Error"))
})

app.post('/decision', (req, res) => {
    value = req.body;
    let result = "Pending";
    let flag = 0;
    result = value.status
    db('teacher_login').where('tuserid', '=', value.tuserid.toUpperCase()).select('*')
        .update({
            approval: value.status,
        }).then(a => {
            db('teacher_details').select('email', 'firstname').where('tuserid', '=', value.tuserid.toUpperCase())
                .then(user => {
                    const accessToken = oauth2Client.getAccessToken()
                    const smtpTransport = nodemailer.createTransport({
                        service: "gmail",
                        auth: {
                            type: "OAuth2",
                            user: "odmldatabaseemailer@gmail.com",
                            clientId: '419164085262-tsia15f1698ghin5d0du8svoaa83jfjo.apps.googleusercontent.com',
                            clientSecret: 'JY342uAw-OCGBFB8Q8hJKvQ8',
                            refreshToken: "1//04NifLUD2U7EMCgYIARAAGAQSNwF-L9IrixDQaamg8TXDckYG-h8ICbs6ZzQlIC0ZlNrO5Tb8lN-C_hWlEl__Hz2WzPq7Bd1WQiI",
                            accessToken: accessToken,
                            tls: {
                                rejectUnauthorized: false
                            }
                        }
                    });
                    const mailOptionsBad = {
                        from: "odmldatabaseemailer@gmail.com",
                        to: user[0].email,
                        subject: "odmlManagement System Verification",
                        generateTextFromHTML: true,
                        html: `<p>Welcome ${user[0].firstname}</p>
                            <img src=${'https://pbs.twimg.com/media/Dzr9t7xX4AAdKzq.jpg:large'} alt="Welcome_img">
                            <p>
                              We Regret to inform you that your registration request was rejected. 
                              <br />
                            </p>
                            <b style="font-size:20px">Please contact the Admin for Any Queries</b>`
                    };

                    const mailOptionsGood = {
                        from: "odmldatabaseemailer@gmail.com",
                        to: user[0].email,
                        subject: "odmlManagement System Verification",
                        generateTextFromHTML: true,
                        html: `<p>Welcome ${user[0].firstname}</p>
                            <img src=${'https://miro.medium.com/max/1838/1*XX2X4OtFiQTdYV3OtIlAIg.png'} alt="Welcome_img">
                            <p>
                              We are glad to Inform you that you have been successfully registered into the OD/ML System
                              <br />
                            </p>
                            <b style="font-size:20px">Please contact the Admin for Any Queries</b>`
                    };
                    if (result == "REJECTED") {
                        smtpTransport.sendMail(mailOptionsBad, (error, response) => {
                            error ? res.status(400).json("Error in Sending Email") : console.log(response);
                            smtpTransport.close();
                        });
                    }
                    else {
                        smtpTransport.sendMail(mailOptionsGood, (error, response) => {
                            error ? res.status(400).json("Error in Sending Email") : console.log(response);
                            smtpTransport.close();
                        });
                    }
                }).catch(err => { return res.status(400).json("Error in Sending Email") })
        }).then(a => {
            res.json("success")
        })
        .catch(err => { return res.status(400).json("Teacher not Present") })
})

app.post('/signinadmin', (req, res) => {
    const value = req.body;
    var val = 0;
    val = value.password;
    if (val === 'Amrita@admin2310') {
        res.json({ status: "Success" })
    }
    else {
        res.status(400).json({ status: "Fail" });

    }

})

app.post('/revoke', (req, res) => {
    const value = req.body;
    if (value.id == 'student') {
        db('student_login').where('suserid', '=', value.userid)
            .update({
                approval: 'Pending',
            })
            .then(user => {
                res.status(200).json("Success")
            }).catch(err => res.status(400).json("Fail"))
    }
    else {
        db('teacher_login').where('tuserid', '=', value.userid)
            .update({
                approval: 'Pending',
            })
            .then(user => {
                res.status(200).json("Success")
            }).catch(err => res.status(400).json("Fail"))
    }
})

app.post('/requestpassword', (req, res) => {
    generateOTP()
    const value = req.body;
    let query;
    let param;
    let innerquery;
    if (value.id === 'student') { param = "suserid"; query = "student_details"; innerquery = "student_login" } else { param = "tuserid"; query = "teacher_details"; innerquery = "teacher_login" }
    db.select('email', param).from(query)
        .where('email', '=', value.email)
        .then(data => {
            if (data.length >= 1) {
                db(innerquery).select('password').where(param, '=', data[0].suserid ? data[0].suserid : data[0].tuserid)
                    .then(user => {
                        const accessToken = oauth2Client.getAccessToken()
                        const smtpTransport = nodemailer.createTransport({
                            service: "gmail",
                            auth: {
                                type: "OAuth2",
                                user: "odmldatabaseemailer@gmail.com",
                                clientId: '419164085262-tsia15f1698ghin5d0du8svoaa83jfjo.apps.googleusercontent.com',
                                clientSecret: 'JY342uAw-OCGBFB8Q8hJKvQ8',
                                refreshToken: "1//04NifLUD2U7EMCgYIARAAGAQSNwF-L9IrixDQaamg8TXDckYG-h8ICbs6ZzQlIC0ZlNrO5Tb8lN-C_hWlEl__Hz2WzPq7Bd1WQiI",
                                accessToken: accessToken,
                                tls: {
                                    rejectUnauthorized: false
                                }
                            }
                        });
                        const mailOptions = {
                            from: "odmldatabaseemailer@gmail.com",
                            to: value.email,
                            subject: "odmlManagement System Verification",
                            generateTextFromHTML: true,
                            html: `<p>Welcome,</p>
                        <img src=${'https://static.goanywhere.com/img/blog-images/2017/08/Untitled%20design.jpg'} alt="Password_img">
                        <p>
                            Here is your Password!!
                            <br />
                        </p>
                        <b style="font-size:30px">${user[0].password}</b>`
                        };
                        smtpTransport.sendMail(mailOptions, (error, response) => {
                            error ? console.log(error) : console.log(response);
                            smtpTransport.close();
                        }).catch(err => res.status(400).json("Fail"))
                    }).catch(err => res.status(200).json("Failure"))
            }
            else {
                res.status(400).json({ status: "Can't Find Email" });
            }
        }).then(data => {
            res.json('Success Email Sent')
        }).catch(err => res.status(400).json("Fail"))
})

app.post('/leaverequest', (req, res) => {
    const value = req.body;
    db('leave_details').where('suserid', '=', value.suserid).where('dos', '=', value.dos).where('doe', '=', value.doe).where('reason', '=', value.reason).select('*')
        .then(user => {
            if (user.length > 0) {
                res.status(200).json({ status: "Redundant copies of Leave Records", suserid: value.suserid })
            }
            else {
                db.transaction(trx => {
                    trx.insert({
                        suserid: value.suserid,
                        tuserid: value.tuserid,
                        dos: value.dos,
                        doe: value.doe,
                        branch: value.branch,
                        approval: 'Pending',
                        reason: value.reason,
                        cert: value.cert
                    }).into("leave_details")
                        .returning('suserid').then(data => {
                            res.json({ status: "Successfully Registered Leave", suserid: value.suserid })
                        })
                        .then(trx.commit)
                        .catch(trx.rollback)
                }).catch(err => res.status(400).json('Unable to register the Given User\'s Request , This may be due to server or network error'))
            }
        })
})

app.get('/leavestatus/:roll', (req, res) => {
    const value = req.params;
    db('leave_details').select('*').where('suserid', '=', value.roll.toUpperCase())
        .then(user => {
            if (user.length) {
                res.json(user)
            }
            else {
                res.status(200).json("No Data Available as of Now")
            }
        })
        .catch(err => res.status(400).json("Some Unexpected Error"))
})

app.post('/getotpsignin', (req, res) => {
    generateOTP()
    const value = req.body
    let query = ""
    let param = ""
    let firstname = ''
    let lastname = ''
    if (value.userid[0] === 'C' && value.userid[1] === 'B') { query = 'student_details'; param = 'suserid' } else { query = 'teacher_details'; param = 'tuserid' }
    db(query).select('*').where(param, '=', value.userid).then(user => {
        firstname = user[0].firstname
        lastname = user[0].lastname
        let msg = `Verify With One Time Password : ${otp}`
        var options = { authorization: 'gEM8ZdaKYrpnvR3h4m9qJUeSP2XFtljAx6DfkC5swNWo0b7VOHJ0Rw5pkhXoNyFnaOAtQbPUf8zZKHeq', message: msg, numbers: [`${user[0].ph_no}`] }
        fast2sms.sendMessage(options).then(data => {
            if (query === 'teacher_details') {
                db('teacher_login').select('*').where('tuserid', '=', value.userid)
                    .then(a => {
                        let chair = a[0].chairperson
                        res.status(200).json({ 'chair': chair, 'firstname': firstname, 'lastname': lastname })
                    }).catch(err => res.status(400).json("Fail"))
            }
            else { res.status(200).json({ 'firstname': firstname, 'lastname': lastname }) }
        }).catch(err => {
            res.status(400).json("Failed")
        })
    }).catch(err => { res.status(400).json("Failed") })
})

app.post('/verifysigninotp', (req, res) => {
    const value = req.body;
    if (value.otp === otp) {
        res.status(200).json("Success")
    }
    else {
        res.status(400).json("Fail")
    }
})


app.listen(3001, () => {
    console.log('App is running on the port 3001');
})
