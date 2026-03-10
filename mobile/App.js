import React from 'react';
import { View, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

// Employee Dashboard WebView Wrapper
// This displays the full employee portal from the web app
export default function App() {
  const employeePortalUrl = 'https://aiclock-82608.web.app/pages/employee-login.html';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <WebView
        source={{ uri: employeePortalUrl }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        // Allow camera and media permissions for QR scanning
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        // Handle navigation
        onShouldStartLoadWithRequest={(request) => {
          // Allow all navigation within the app
          return true;
        }}
        // Inject JavaScript to improve mobile experience
        injectedJavaScript={`
          // Add viewport meta tag for better mobile scaling
          const meta = document.createElement('meta');
          meta.name = 'viewport';
          meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
          document.getElementsByTagName('head')[0].appendChild(meta);
          
          // Add mobile app marker
          window.isMobileApp = true;
          true; // Required for iOS
        `}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight : 0,
  },
  webview: {
    flex: 1,
  },
});
