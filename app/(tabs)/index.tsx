import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
export default function Home() {
  return (
   
     

  <LinearGradient
      colors={["#000000", "#9333EA", "#312E81"]} // black → purple-500 → indigo-900
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      className="flex-1 items-center justify-center"
    >
      <Text className="text-white text-2xl">Gradient Background</Text>
    </LinearGradient>

     
   
  );
}

