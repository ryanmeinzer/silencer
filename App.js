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
    // Set initial volume to 0
    await sound.setVolumeAsync(0);
    await sound.playAsync();

    // Helper function to change volume and apply delay
    async function changeVolume(sound, volume, delay) {
      await sound.setVolumeAsync(volume);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Helper function to check volume
    async function checkVolume(sound) {
      const status = await sound.getStatusAsync();
      console.log('Current volume:', status.volume);
    }

    // Fade in with the most subtle volume increases possible over ~20 seconds (ToDo - increase for launch)
    for (let volume = 0; volume <= 1; volume += 0.001) {
      await changeVolume(sound, volume, 10); 
      await checkVolume(sound)
    }
    console.log('Audio fade in finished');

    // Wait for 1 second (ToDo - make 10 minutes with 600000 for launch)
    await new Promise(resolve => setTimeout(resolve, 1000));
    await checkVolume(sound)
    console.log('10 seconds wait finished')

    // Fade out with the most subtle volume decreases possible over ~20 seconds (ToDo - increase for launch)
    for (let volume = 1; volume >= 0; volume -= 0.001) {
      await changeVolume(sound, volume, 10);
      await checkVolume(sound)
    }
    console.log('Audio fade out finished');
    await stopRecording(recording); // Stop the recording
    await startRecording(); // Start a new recording
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
