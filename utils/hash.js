import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hashPassword(plain) {
    return await bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hashed) {
    return await bcrypt.compare(plain, hashed);
}