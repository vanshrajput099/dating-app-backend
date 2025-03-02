import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_APP_USERNAME,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

export const sendMailFunction = async (mail, OTP) => {
    const mailOptions = {
        from: process.env.GMAIL_APP_USERNAME,
        to: mail,
        subject: "OTP Code",
        text: "OTP CODE",
        html: `
                <h1>Sign-UP OTP</h1>
                <p>Your Sign-up OTP is ${OTP}</p>
              `,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.log("Error while sending mail " + error.message);
    } finally {
        transporter.close();
    }
}
