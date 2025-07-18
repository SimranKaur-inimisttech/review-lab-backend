import { supabaseAdmin } from "@/config/supabaseAdmin";
import { ApiError } from "@/utils/ApiError";
import { User } from "./types/user";

export const getUserByEmail = async (email: string) => {
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        throw new ApiError(400, `Error checking user existence: ${error.message}`);
    }

    return data;
};

export const createUserWithEmailAndPassword = async ({
    email,
    password,
    firstName,
    lastName,
    role,
    is_email_verified = true,
}: User) => {
    const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            firstName,
            lastName,
            full_name: `${firstName} ${lastName}`.trim(),
            is_email_verified,
            role
        },
    });

    if (error || !user) {
        throw new ApiError(500, error?.message || 'User creation failed');
    }

    return user;
};