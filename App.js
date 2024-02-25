import React, { useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { Audio } from 'expo-av';

export default function App() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [recording, setRecording] = useState(null);
  const [whiteNoiseSound, setWhiteNoiseSound] = useState(null);

  const recordingSettings = {
    android: {
      extension: '.wav',
      outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_WAV,
      audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: '.wav',
      audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
      playsInSilentModeIOS: true,
    },
    isMeteringEnabled: true,
  };

  async function requestMicrophonePermission() {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  }

  async function startRecordingAndMonitoring() {
    console.log('Starting recording and monitoring...');
    if (!(await requestMicrophonePermission())) {
      alert('Microphone permission is required to use this feature.');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: 1,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(recordingSettings);
      newRecording.setOnRecordingStatusUpdate((status) => {
        // console.log('Recording status update:', status);
        if (status.isRecording && status.metering > -30) { 
          playWhiteNoise();
          console.log('threshold triggered')
        }
      });
      await newRecording.startAsync();
      console.log('Recording started');
      setRecording(newRecording);

      setIsMonitoring(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }

  async function playWhiteNoise() {
    console.log('whiteNoiseSound:', whiteNoiseSound);
    if (!whiteNoiseSound) {
      const { sound } = await Audio.Sound.createAsync(
        require('../silencer/white_noise.mp3'),
        { shouldPlay: true, playsInSilentModeIOS: true }
      );
      setWhiteNoiseSound(sound);
      await sound.setVolumeAsync(0.95); // Set volume to 95%
      await sound.playAsync(); // Play the sound after it's loaded
      console.log('inside !whiteNoiseSound')
    } else {
      await whiteNoiseSound.playAsync();
    }
  }

  async function stopRecordingAndMonitoring() {
    if (recording) {
      await recording.stopAndUnloadAsync();
      setRecording(null);
    }
  
    if (whiteNoiseSound) {
      console.log("Stopping and unloading white noise sound");
      await whiteNoiseSound.stopAsync();
      await whiteNoiseSound.unloadAsync();
      setWhiteNoiseSound(null);
    }
  
    setIsMonitoring(false);
  }  

  const toggleMonitoring = () => {
    if (isMonitoring) {
      stopRecordingAndMonitoring();
    } else {
      startRecordingAndMonitoring();
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
