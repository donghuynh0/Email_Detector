import { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import './GmailApp.css';

const clientId = '265358396513-goqheq2t96ini3k5sclkdob63sg6ur1g.apps.googleusercontent.com';
const apiKey = 'AIzaSyD5bGSUeAlORjzAJYMYMFvvFs3AEbqzN7c';
const scope = 'https://www.googleapis.com/auth/gmail.readonly';

function GmailApp() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [emails, setEmails] = useState([]);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: '', avatar: '' });

  useEffect(() => {
    function start() {
      gapi.client.init({
        apiKey: apiKey,
        clientId: clientId,
        scope: scope,
      })
        .then(() => {
          const authInstance = gapi.auth2.getAuthInstance();
          setIsSignedIn(authInstance.isSignedIn.get());
          authInstance.isSignedIn.listen(setIsSignedIn);

          gapi.client.load('gmail', 'v1', () => {
            setIsApiLoaded(true);
          });
        })
        .catch((error) => {
          console.error('Error initializing gapi client', error);
        });
    }

    gapi.load('client:auth2', start);
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      const profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
      setUserProfile({
        name: profile.getName(),
        avatar: profile.getImageUrl(),
      });
    }
  }, [isSignedIn]);

  const fetchEmails = async () => {
    if (!isApiLoaded) return;

    setLoading(true);
    const maxRetries = 5;
    let retries = 0;
    let delayTime = 1000;

    while (retries < maxRetries) {
      try {
        const response = await gapi.client.gmail.users.messages.list({
          userId: 'me',
          labelIds: ['INBOX'],
          q: 'is:unread',
        });

        const messages = response.result.messages || [];
        if (messages.length === 0) {
          setLoading(false);
          return;
        }

        const emailPromises = messages.map((message) =>
          gapi.client.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
          }).then((messageResponse) => {
            const emailData = messageResponse.result;
            return {
              sender: emailData.payload.headers.find(h => h.name === 'From')?.value,
              subject: emailData.payload.headers.find(h => h.name === 'Subject')?.value,
              preview: emailData.snippet || 'No preview available',
              date: new Date(parseInt(emailData.internalDate)).toLocaleString(),
            };
          })
        );

        await Promise.all(emailPromises).then(emailsData => {
          setEmails(emailsData);
        });

        break;
      } catch (error) {
        if (error?.body?.includes('RESOURCE_EXHAUSTED') && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayTime));
          retries++;
          delayTime *= 2;
        } else {
          console.error('Error fetching emails:', error);
          break;
        }
      }
    }

    setLoading(false);
  };

  const handleSignIn = () => {
    gapi.auth2.getAuthInstance().signIn();
  };

  const handleSignOut = () => {
    gapi.auth2.getAuthInstance().signOut();
  };

  return (
    <div className="gmail-app">
      {isSignedIn ? (
        <div className="app-content">
          {/* Logout Button on the Left */}
          <button className="sign-out-button" onClick={handleSignOut}>Sign Out</button>

          {/* Header with User Profile on the Right */}
          <div className="header">
            <img src={userProfile.avatar} alt="User Avatar" className="avatar" />
            <span className="user-name">{userProfile.name}</span>
          </div>

          {/* Centered Fetch Emails Button */}
          <div className="centered-button">
            <button className="fetch-emails-button" onClick={fetchEmails} disabled={loading}>
              {loading ? 'Loading...' : 'Fetch Emails'}
            </button>
          </div>

          <EmailList emails={emails} />
        </div>
      ) : (
        <button className="sign-in-button" onClick={handleSignIn}>
          <img 
            src="https://developers.google.com/identity/images/g-logo.png" 
            alt="Google Logo" 
            className="google-logo" 
          />
          Sign In with Google
        </button>
      )}
    </div>
  );
}

function EmailList({ emails }) {
  return (
    <div className="emails-list">
      <table className="table">
        <tbody>
          {emails.map((email, index) => (
            <tr key={index} className="email-item">
              <td className="px-6 py-4 whitespace-nowrap">
                <input type="checkbox" className="form-checkbox" />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <i className="far fa-star"></i>
              </td>
              <td className="email-sender">
                {email.sender}
              </td>
              <td className="email-subject">
                {email.subject}
              </td>
              <td className="email-preview">
                {email.preview}
              </td>
              <td className="email-date">
                {email.date}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default GmailApp;
