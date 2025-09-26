if [[ $# -ge 1 && $1 =~ ^[0-9]+$ ]]; then
  NUM_INSTANCES=$1
  for i in $(seq 1 $NUM_INSTANCES); do
    yes > /dev/null &
    echo "Started instance $i with PID $!"
  done
elif [[ $# -eq 1 && $1 == "--stop" ]]; then
  killall yes
  echo "Stopped all cpustress instances."
else
  echo "Usage: $0 <number_of_instances> or $0 --stop"
  exit 1
fi
