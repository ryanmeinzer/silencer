import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { Audio } from 'expo-av';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [sound, setSound] = useState(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [isMonitoring, setIsMonitoring] = useState(false);

  async function startRecording() {
    try {
      if (permissionResponse.status !== 'granted') {
        console.log('Requesting permission..');
        await requestPermission();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        // ToDo - add UIBackgroundModes to standalong app configuration
        // https://docs.expo.dev/versions/latest/sdk/audio/#playing-or-recording-audio-in-background
        staysActiveInBackground: true,
      });
      const { recording } = await Audio.Recording.createAsync( Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      console.log('Recording started');
      setIsMonitoring(true);
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering > -30) { 
          console.log('threshold triggered')
          playWhiteNoise(recording)
        }
      });
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function playWhiteNoise(recording) {
    const { sound } = await Audio.Sound.createAsync(
      require('../silencer/white_noise.mp3'),
      // ToDo - experiment if below is even needed
      // { shouldPlay: true, playsInSilentModeIOS: true }
    );
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
    setSound(sound);
    console.log('Playing Sound');
    await sound.playAsync();
    await stopRecording(recording)
    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.didJustFinish) {
        console.log('Audio playback finished');
        await startRecording();
      }
    });
  }

  async function stopRecording(recording) {
    console.log('Stopping recording..');
    setRecording(undefined);
    await recording.stopAndUnloadAsync();
    // iOS reroutes audio playback to phone earpiece instead of speaker with allowsRecordingIOS, so disable when playing whiteNoise and once finished
    await Audio.setAudioModeAsync(
      {
        allowsRecordingIOS: false,
      }
    );
    setIsMonitoring(false)
  }

  useEffect(() => {
    return sound
      ? () => {
          console.log('Unloading Sound');
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const toggleMonitoring = async () => {
    if (isMonitoring) {
      await stopRecording(recording);
    } else {
      await startRecording()
    }
  };

  return (
    <View style={styles.container}>
      <Text>Silencer.ai</Text>
      <Button
        onPress={toggleMonitoring}
        title={isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
