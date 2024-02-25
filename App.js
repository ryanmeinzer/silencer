import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { Audio } from 'expo-av';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [whiteNoiseSound, setWhiteNoiseSound] = useState(null);
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

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync( Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      console.log('Recording started');
      monitorRecording(recording);
      setIsMonitoring(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  function monitorRecording(recording) {
    recording.setOnRecordingStatusUpdate((status) => {
      // console.log('monitorRecording() -> status:', status);
      if (status.isRecording && status.metering > -30) { 
        console.log('threshold triggered')
        // ToDo - allowsRecordingIOS: false to enhance audio by nearly 2x
        // stopRecording()
        playWhiteNoise();
        // ToDo - re-enable after whiteSound plays, likely need to use playback status
        // startRecording()
      }
    });
  }

  // ToDo - allowsRecordingIOS: false to enhance audio by nearly 2x
  async function playWhiteNoise() {
    const { sound } = await Audio.Sound.createAsync(
      require('../silencer/white_noise.mp3'),
      // ToDo - experiment if below is even needed
      // { shouldPlay: true, playsInSilentModeIOS: true }
    );
    setWhiteNoiseSound(sound);
    console.log('Playing Sound');
    await sound.playAsync();
  }

  async function stopRecording() {
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
    return whiteNoiseSound
      ? () => {
          console.log('Unloading Sound');
          whiteNoiseSound.unloadAsync();
        }
      : undefined;
  }, [whiteNoiseSound]);

  const toggleMonitoring = () => {
    if (isMonitoring) {
      stopRecording();
    } else {
      startRecording()
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
