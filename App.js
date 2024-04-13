import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { Audio } from 'expo-av';

export default function App() {
  const [recording, setRecording] = useState();
  // ref instead of state to ensure synchronicity instead of batched in state updates along with re-render triggers
  const cancellationRef = useRef(false);
  const [sound, setSound] = useState();
  const [countdown, setCountdown] = useState(0);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  async function startRecording(applyDelay = false) {
    try {
      cancellationRef.current = false; // Reset cancellation status when starting
      if (permissionResponse.status !== 'granted') {
          console.log('Requesting permission..');
          await requestPermission();
      }

      if (applyDelay) {
        setRecording({ placeholder: true });
        setCountdown(3);  // set initial countdown value
        await new Promise((resolve, reject) => {
          const intervalId = setInterval(() => {
            setCountdown((currentCountdown) => {
              if (currentCountdown === 1 || cancellationRef.current) {
                clearInterval(intervalId);  // Stop the interval when countdown reaches 0
                if (cancellationRef.current) {
                    console.log('Recording start cancelled');
                    reject('Cancelled');
                } else {
                    resolve();
                }
              }
              return currentCountdown - 1;
            });
          }, 1000);
        });
        console.log('initial monitoring delay finished');
      }

      if (cancellationRef.current) {
        console.log('Cancelled before setting recording');
        return; // Exit if cancellation occurred during the delay
      }

      await configureAudioMode(true);  // Set the audio mode for recording
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);  // Update the state with the actual recording object
      configureRecording(recording);  // Set up recording configuration
    } catch (err) {
      if (err !== 'Cancelled') {
        console.error('Failed to start recording', err);
      }
    }
  }

  // iOS reroutes audio playback to phone earpiece instead of speaker with allowsRecordingIOS, so disable when playing whiteNoise and once finished
  async function configureAudioMode(forRecording = true) {
    try {
        if (forRecording) {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                // ToDo - add UIBackgroundModes to standalong app configuration
                // https://docs.expo.dev/versions/latest/sdk/audio/#playing-or-recording-audio-in-background
                staysActiveInBackground: true,
            });
        } else {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
            });
        }
    } catch (err) {
        console.error('Failed to set audio mode', err);
    }
  }

  function configureRecording(recording) {
      recording.setOnRecordingStatusUpdate((status) => {
        // ToDo - potentially increase sensitivity of noise detection for launch  
        if (status.isRecording && status.metering > -30) { 
              console.log('threshold triggered');
              playWhiteNoise(recording);
        }
      });
      console.log('Recording started');
  }

  async function playWhiteNoise(recording) {
    const { sound } = await Audio.Sound.createAsync(
      require('../silencer/white_noise.mp3'),
      // ToDo - experiment if below is even needed
      { shouldPlay: true, playsInSilentModeIOS: true }
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
      // console.log('Current volume:', status.volume);
    }

    // Fade in with the most subtle volume increases possible over ~20 seconds (ToDo - increase for launch)
    for (let volume = 0; volume <= 1; volume += 0.01) { // make 0.001 for ~20s
      await changeVolume(sound, volume, 1); // make 10 for ~20s
      await checkVolume(sound)
    }
    console.log('Audio fade in finished');

    // Wait for 1 second (ToDo - make 10 minutes with 600000 for launch)
    await new Promise(resolve => setTimeout(resolve, 1000));
    await checkVolume(sound)
    console.log('10 seconds wait finished')

    // Fade out with the most subtle volume decreases possible over ~20 seconds (ToDo - increase for launch)
    for (let volume = 1; volume >= 0; volume -= 0.01) { // make 0.001 for ~20s
      await changeVolume(sound, volume, 1); // make 0.001 for ~20s
      await checkVolume(sound)
    }
    console.log('Audio fade out finished');
    const status = await recording.getStatusAsync();
    // If manually Stop Monitoring, prevent stopRecording from running twice but stop sound
    if (!status.isDoneRecording) {
      await stopRecording(recording, sound); // Stop the recording and sound
      console.log('stopping recording and sound')
      await startRecording(); // Start a new recording
      console.log('starting recording')
    } else {
      if (sound) {
        await sound.stopAsync()
        console.log('stopping sound')
      }
    }
  }

  async function stopRecording(recording, sound) {
    try {
        cancellationRef.current = true; // Signal that any ongoing recording start should be cancelled
        setCountdown(0); // Reset the countdown to make it disappear from the UI
        console.log('Stopping recording..');
        if (recording && typeof recording.stopAndUnloadAsync === 'function') {
            await recording.stopAndUnloadAsync();  // Correctly calling stop on the actual recording object
        }
        setRecording(undefined);  // Clear the recording state
        if (sound) {
            await sound.stopAsync();  // Stop any sound that may be playing
        }
        await configureAudioMode(false);  // Reset the audio mode for non-recording state
    } catch (err) {
        console.error('Failed to stop recording', err);
    }
  }

  // unload sound after when component unmounts (cleanup)
  useEffect(() => {
    return () => {
      if (sound) {
        console.log('Unloading Sound');
        sound.unloadAsync();
      }
    };
  }, []);

  const toggleRecording = async () => {
    if (recording) {
      // ensure the correct sound object is passed
      await stopRecording(recording, sound);
    } else {
      await startRecording(true) // enable applyDelay
    }
  };

  return (
    <View style={styles.container}>
      <Text>Silencer.ai</Text>
      <Button
        title={recording ? 'Stop Monitoring' : 'Start Monitoring'}
        onPress={toggleRecording}
      />
      {countdown > 0 && (
        <Text>Monitoring starting in {countdown} seconds...</Text>
      )}
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
