import { Pressable, Text, View } from "react-native";

export type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View>
      <Text testID="error-message">{message}</Text>
      <Pressable testID="error-retry" onPress={onRetry}>
        <Text>Retry</Text>
      </Pressable>
    </View>
  );
}
