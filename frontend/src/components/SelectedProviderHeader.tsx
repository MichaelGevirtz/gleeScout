import { StyleSheet, Text, View } from "react-native";

export interface SelectedProviderHeaderProps {
  providerName: string;
}

export default function SelectedProviderHeader({ providerName }: SelectedProviderHeaderProps) {
  return (
    <View testID="selected-provider-header" style={styles.container}>
      <Text testID="selected-provider-header-label" style={styles.label}>
        Selected provider
      </Text>
      <Text testID="selected-provider-header-name" style={styles.name}>
        {providerName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#9ca3af",
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
});
