import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

const supabaseUrl = "https://mknsvxajrvdlwqywvlrf.supabase.co";
const supabaseKey = "sb_publishable_i1L1dBbWF-c5ntUINgnUyQ_rWbxB_bw";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    ...(Platform.OS !== "web"
      ? {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        }
      : {}),
  },
});