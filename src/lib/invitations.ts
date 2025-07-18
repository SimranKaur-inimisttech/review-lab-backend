import { supabaseAdmin } from "@/config/supabaseAdmin";
import { ApiError } from "@/utils/ApiError";

export const getValidInvitationByToken = async (token: string) => {
    const { data: invitation, error } = await supabaseAdmin
        .from('team_invitations')
        .select('id, team_id, invited_by,role, email,invited_at')
        .eq('token', token)
        .eq('status', 'pending')
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

    if (error || !invitation) {
        throw new ApiError(400, 'Invalid or expired invitation');
    }

    return invitation;
};
