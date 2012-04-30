#!/usr/bin/python

from optparse import OptionParser
import os
import sys
import fileinput
import getpass
import urllib2

try:
  import json
except:
  import simplejson as json

parser = OptionParser(description="Pastie is a secure internal paste bin.")

parser.add_option("-d", "--description", dest="description",
    action="store", help="description")
parser.add_option("-p", "--private", dest="private",
    action="store_true", help="create private pastie")
#parser.add_option("-l", dest="user",
    #action="store", help="list pasties created by USER")
#parser.add_option("--print", dest="pastie_id",
    #action="store", help="print the pastie to stdout")
parser.add_option("-x", "--expires", dest="expiry",
    action="store", help="delete the pastie in the future. E.g. 10m, 1d, 2h")
#parser.add_option("-d", dest="delete_id",
    #action="store", help="delete the pastie")

(options, args) = parser.parse_args()


def read_config():
  #print os.path.dirname(os.path.realpath(__file__))
  handle = open(os.path.join(os.path.dirname(os.path.realpath(__file__)), "config.json"))
  if not handle:
    return None
  return json.loads(handle.read())

def save_pastie(options, config):
  data = []

  while 1:
    s = sys.stdin.readline()
    if not s:
      break
    data.append(s)

  payload = {"content": ''.join(data), "author": getpass.getuser()}

  if options.description:
    payload["description"] = options.description;

  if options.private:
    payload["private"] = 1;

  if options.expiry:
    payload["expiry"] = convert_expiry_to_seconds(options.expiry)

  payload = json.dumps({"pastie": payload});

  #print payload
  req = urllib2.Request(config["host"] + "/pastie", payload, {"content-type": "application/json"})
  res = urllib2.urlopen(req).read()
  return json.loads(res)

def convert_expiry_to_seconds(expiry_expr):
  scalar = {
    "s": 1,
    "m": 60,
    "h": 60*60,
    "d": 60*60*24,
    "w": 60*60*24*7,
    "m": 60*60*24*7*30,
    "y": 60*60*24*7*365,
  }[expiry_expr[-1]]
  num = int(expiry_expr[:-1])
  if not num:
    return False
  else:
    return num*scalar

def main():
  config = read_config()
  if not config:
    print "You must include a config file."
  #elif options.user:
    #res = urllib2.urlopen(config["host"] + "/pastie/user/" + options.user).read()
    #res = JSON.loads(res)
    #for r in res["pasties"]:
      #print r["resource"], "    ", r["description"]
  #elif options.pastie_id:
    #res = urllib2.urlopen(config["host"] + "/pastie/" + options.pastie_id).read()
    #res = JSON.loads(res)
    #print res
    #print res["pastie"]["content"]
  else:
    res = save_pastie(options, config)
    if res["pastie"]["id"]:
      print os.path.join(config["host"], "pastie", res["pastie"]["id"])
    elif res["error"]:
      print res["error"]

if __name__ == "__main__":
  main()
