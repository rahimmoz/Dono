import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://dgqvehfsnqywbfsyfugj.supabase.co';
const supabaseAnonKey = 'sb_publishable_qa9d5NGD5kST6VD99RybbQ_o8-DUiHd';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);