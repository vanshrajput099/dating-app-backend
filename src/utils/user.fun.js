import bcrypt from 'bcrypt';

export const encryptUserPassword = async password => {
    return await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS));
}

export const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
}
