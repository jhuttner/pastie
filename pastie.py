#!/usr/bin/python

import base64
import getpass
from optparse import OptionParser
import sys
import urllib2


CONFIG_FILE_PATH = '/etc/pastie/config.json'
CONFIG_FILE_EXAMPLE = '''
{
   "host": "http://your-pastie-server",
   "port": "3000" # This field is optional - http:// defaults to port 80
}
'''

try:
  import json
except:
  import simplejson as json


parser = OptionParser(description='Pastie is a secure internal paste bin.')
parser.add_option('-d', '--delete', dest='delete',
    help='delete an existing pastie')
parser.add_option('-p', '--public', dest='public',
    action='store_true', help='create a public pastie (listed on pastie homepage)')
parser.add_option('-x', '--expires', dest='expiry',
    action='store', help='Expire the pastie after expiry units. E.g. 1s, 2m, 3s, 4m, 5d, 5w, 6m, 7y.  No units implies days.')


def convert_expiry_to_seconds(text):
  try:
    return int(text) * 60*60*24
  except:
    pass
  scalar = {
    's': 1,
    'm': 60,
    'h': 60*60,
    'd': 60*60*24,
    'w': 60*60*24*7,
    'm': 60*60*24*7*30,
    'y': 60*60*24*7*365,
  }[text[-1]]
  num = int(text[:-1])
  if not num:
    return False
  else:
    return num*scalar

def read_config():
  f = open(CONFIG_FILE_PATH)
  result = json.load(f)
  f.close()
  return result

def get_url(config):
  if config.get('port'):
    url = '%s:%s' % (config['host'], config['port'])
  else:
    url = '%s' % (config['host'])
  return url

def delete_pastie(options, config):
  req = urllib2.Request(get_url(config) + '/pastie/' + options.delete)
  req.get_method = lambda: 'DELETE'
  res = urllib2.urlopen(req).read()
  return json.loads(res)

def save_pastie(options, config):
  data = []

  while 1:
    s = sys.stdin.readline()
    if not s:
      break
    data.append(s)

  payload = {
    'content': base64.b64encode(''.join(data)), 
    'author': getpass.getuser()
  }

  if options.public:
    payload['public'] = 1;

  if options.expiry:
    payload['expiry'] = convert_expiry_to_seconds(options.expiry)

  payload = json.dumps({'pastie': payload});

  req = urllib2.Request(get_url(config) + '/pastie', payload, {'content-type': 'application/json'})
  res = urllib2.urlopen(req).read()
  return json.loads(res)

def main():

  (options, args) = parser.parse_args()
  try:
    config = read_config()
  except IOError:
    print 'You must include a config file at ', CONFIG_FILE_PATH
    print 'Example:'
    print CONFIG_FILE_EXAMPLE
    sys.exit(1)

  if options.delete:
    res = delete_pastie(options, config)
    print res['message']
  else:
    res = save_pastie(options, config)
    if res['pastie']['id']:
      url = '%s/pastie/%s%s' % (get_url(config),
                                res['pastie']['id'],
                                res['pastie']['extension'])
      print url
    elif res['error']:
      print res['error']

if __name__ == '__main__':
  main()
