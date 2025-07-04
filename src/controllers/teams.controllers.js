import { supabase } from "../config/supabaseClient.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getTeams= asyncHandler(async(req,res)=>{
  const response= await supabase.from('teams').select();

//   if (error) {
//     throw new ApiError(500, error.message);
//   }

//   res.status(200).json(new ApiResponse(200, data, 'Teams fetched successfully'));
});